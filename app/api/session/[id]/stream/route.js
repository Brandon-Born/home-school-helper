import { ApiError } from "../../../../../src/server/api-error.js";
import { listSessionMessages } from "../../../../../src/server/session-foundation-service.js";
import { resolveSessionViewerContext } from "../../../../../src/server/session-viewer-context.js";

const encoder = new TextEncoder();

export function serializeSse(event, payload) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

export function createStreamGetHandler(dependencies = {}) {
  const resolveViewerContext = dependencies.resolveSessionViewerContext ?? resolveSessionViewerContext;
  const listMessages = dependencies.listSessionMessages ?? listSessionMessages;
  const setTimer = dependencies.setTimer ?? ((callback, interval) => setInterval(callback, interval));
  const clearTimer = dependencies.clearTimer ?? ((timerId) => clearInterval(timerId));

  return async function GET(request, { params }) {
    try {
      const url = new URL(request.url);
      const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get("limit") || "150", 10), 1), 300);

      const viewerContext = await resolveViewerContext(request, params.id);

      const stream = new TransformStream();
      const writer = stream.writable.getWriter();
      let closed = false;
      let isPolling = false;
      let seenIds = new Set();

      const initialMessages = await listMessages({
        sessionId: params.id,
        visibility: viewerContext.visibility,
        limit
      });

      for (const message of initialMessages) {
        seenIds.add(message.id);
      }

      await writer.write(
        serializeSse("snapshot", {
          visibility: viewerContext.visibility,
          messages: initialMessages
        })
      );

      const poll = async () => {
        if (closed || isPolling) {
          return;
        }

        isPolling = true;

        try {
          const messages = await listMessages({
            sessionId: params.id,
            visibility: viewerContext.visibility,
            limit
          });

          const fresh = messages.filter((message) => !seenIds.has(message.id));
          if (fresh.length > 0) {
            for (const message of fresh) {
              seenIds.add(message.id);
            }

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

      const pollTimer = setTimer(poll, 1800);
      const keepAliveTimer = setTimer(async () => {
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
        clearTimer(pollTimer);
        clearTimer(keepAliveTimer);

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
  };
}

export const GET = createStreamGetHandler();
