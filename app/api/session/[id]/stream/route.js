import { ApiError } from "../../../../../src/server/api-error.js";
import {
  createSessionMessageSubscription,
  listSessionMessages
} from "../../../../../src/server/session-foundation-service.js";
import { resolveSessionViewerContext } from "../../../../../src/server/session-viewer-context.js";
import { startTranscriptStreamRuntime } from "../../../../../src/server/transcript-stream-runtime.js";
import { runSessionRoute } from "../../../../../src/server/session-route-helpers.js";
import { getServerStreamErrorDetails, logServerStreamTelemetry } from "../../../../../src/server/stream-telemetry.js";

export { serializeSse } from "../../../../../src/server/transcript-stream-runtime.js";

export function createStreamGetHandler(dependencies = {}) {
  const resolveViewerContext = dependencies.resolveSessionViewerContext ?? resolveSessionViewerContext;
  const listMessages = dependencies.listSessionMessages ?? listSessionMessages;
  const subscribeMessages = dependencies.createSessionMessageSubscription ?? createSessionMessageSubscription;
  const setTimer = dependencies.setTimer ?? ((callback, interval) => setInterval(callback, interval));
  const clearTimer = dependencies.clearTimer ?? ((timerId) => clearInterval(timerId));
  const logStreamEvent = dependencies.logStreamEvent ?? logServerStreamTelemetry;

  return async function GET(request, { params }) {
    return runSessionRoute({
      request,
      params,
      fallbackCode: "stream_failed",
      onError: (error, _fallbackCode, context = {}) => {
        const status = error instanceof ApiError ? error.status : 500;
        const code = error instanceof ApiError ? error.code : "stream_failed";
        const message = error instanceof Error ? error.message : "Unknown stream failure";
        logStreamEvent("error", {
          event: "stream_connect_failed",
          session_id: context.sessionId ?? "unknown",
          ...getServerStreamErrorDetails(error)
        });

        return new Response(JSON.stringify({ error: code, message }), {
          status,
          headers: {
            "content-type": "application/json"
          }
        });
      },
      run: async ({ sessionId }) => {
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
          createSessionMessageSubscription: subscribeMessages,
          setTimer,
          clearTimer,
          logStreamEvent,
          streamTransportMode: dependencies.streamTransportMode ?? process.env.STREAM_TRANSPORT_MODE
        });

        logStreamEvent("info", {
          event: "stream_connect",
          session_id: sessionId,
          viewer_role: viewerContext.role,
          visibility: viewerContext.visibility,
          limit
        });

        request.signal.addEventListener("abort", () => {
          void runtime.close("client_abort");
        });

        return new Response(stream.readable, {
          headers: {
            "content-type": "text/event-stream; charset=utf-8",
            "cache-control": "no-cache, no-transform",
            connection: "keep-alive",
            "x-stream-transport-mode": runtime.transportMode ?? "none"
          }
        });
      }
    });
  };
}

export const GET = createStreamGetHandler();
