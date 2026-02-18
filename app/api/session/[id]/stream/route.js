import { ApiError } from "../../../../../src/server/api-error.js";
import { listSessionMessages } from "../../../../../src/server/session-foundation-service.js";
import { resolveSessionViewerContext } from "../../../../../src/server/session-viewer-context.js";
import { startTranscriptStreamRuntime } from "../../../../../src/server/transcript-stream-runtime.js";

export { serializeSse } from "../../../../../src/server/transcript-stream-runtime.js";

export function createStreamGetHandler(dependencies = {}) {
  const resolveViewerContext = dependencies.resolveSessionViewerContext ?? resolveSessionViewerContext;
  const listMessages = dependencies.listSessionMessages ?? listSessionMessages;
  const setTimer = dependencies.setTimer ?? ((callback, interval) => setInterval(callback, interval));
  const clearTimer = dependencies.clearTimer ?? ((timerId) => clearInterval(timerId));

  return async function GET(request, { params }) {
    try {
      const { id: sessionId } = await params;
      const url = new URL(request.url);
      const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get("limit") || "150", 10), 1), 300);

      const viewerContext = await resolveViewerContext(request, sessionId);

      const stream = new TransformStream();
      const writer = stream.writable.getWriter();
      const runtime = await startTranscriptStreamRuntime({
        writer,
        sessionId,
        visibility: viewerContext.visibility,
        limit,
        listSessionMessages: listMessages,
        setTimer,
        clearTimer
      });

      request.signal.addEventListener("abort", runtime.close);

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
