import {
  requireChildSessionContext,
  requireParentContext
} from "../../../../../src/server/auth.js";
import { ApiError } from "../../../../../src/server/api-error.js";
import {
  ensureParentOwnsSession,
  listSessionMessages
} from "../../../../../src/server/session-foundation-service.js";

const encoder = new TextEncoder();

function serializeSse(event, payload) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

export async function GET(request, { params }) {
  try {
    const url = new URL(request.url);
    const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get("limit") || "150", 10), 1), 300);

    let visibility = "all";

    try {
      const { parent } = await requireParentContext(request);
      await ensureParentOwnsSession(parent.id, params.id);
      visibility = "all";
    } catch (parentError) {
      if (!(parentError instanceof ApiError) || parentError.status !== 401) {
        throw parentError;
      }

      await requireChildSessionContext(request, params.id);
      visibility = "child";
    }

    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    let closed = false;
    let isPolling = false;
    let seenIds = new Set();

    const initialMessages = await listSessionMessages({
      sessionId: params.id,
      visibility,
      limit
    });

    for (const message of initialMessages) {
      seenIds.add(message.id);
    }

    await writer.write(
      serializeSse("snapshot", {
        visibility,
        messages: initialMessages
      })
    );

    const poll = async () => {
      if (closed || isPolling) {
        return;
      }

      isPolling = true;

      try {
        const messages = await listSessionMessages({
          sessionId: params.id,
          visibility,
          limit
        });

        const fresh = messages.filter((message) => !seenIds.has(message.id));
        if (fresh.length > 0) {
          for (const message of fresh) {
            seenIds.add(message.id);
          }

          // Prevent unbounded growth in long-lived streams.
          if (seenIds.size > 5000) {
            seenIds = new Set(messages.slice(-400).map((message) => message.id));
          }

          await writer.write(serializeSse("message_append", { messages: fresh }));
        }
      } catch (error) {
        await writer.write(
          serializeSse("error", {
            message: error instanceof Error ? error.message : "Stream polling failed."
          })
        );
      } finally {
        isPolling = false;
      }
    };

    const pollInterval = setInterval(poll, 1800);
    const keepAliveInterval = setInterval(async () => {
      if (closed) {
        return;
      }
      try {
        await writer.write(encoder.encode(":keep-alive\n\n"));
      } catch {
        // Ignore keep-alive write failures during teardown.
      }
    }, 12000);

    const close = async () => {
      if (closed) {
        return;
      }

      closed = true;
      clearInterval(pollInterval);
      clearInterval(keepAliveInterval);

      try {
        await writer.close();
      } catch {
        // Stream already closed.
      }
    };

    request.signal.addEventListener("abort", close);

    return new Response(stream.readable, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive"
      }
    });
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const code = error instanceof ApiError ? error.code : "stream_failed";
    const message = error instanceof Error ? error.message : "Unknown stream failure";

    return new Response(JSON.stringify({ error: code, message }), {
      status,
      headers: {
        "content-type": "application/json"
      }
    });
  }
}
