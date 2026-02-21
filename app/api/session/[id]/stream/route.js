import {
  createSessionMessageSubscription,
  listSessionMessages
} from "../../../../../src/server/session-foundation-service.js";
import { acquireStreamConnectionSlot } from "../../../../../src/server/stream-connection-guard.js";
import { getClientAddress, enforceRateLimit } from "../../../../../src/server/rate-limit.js";
import { buildRateLimitPolicy } from "../../../../../src/server/rate-limit-policies.js";
import { resolveSessionViewerContext } from "../../../../../src/server/session-viewer-context.js";
import { startTranscriptStreamRuntime } from "../../../../../src/server/transcript-stream-runtime.js";
import { toPublicApiError } from "../../../../../src/server/route-errors.js";
import { runSessionRoute } from "../../../../../src/server/session-route-helpers.js";
import { getServerStreamErrorDetails, logServerStreamTelemetry } from "../../../../../src/server/stream-telemetry.js";

export { serializeSse } from "../../../../../src/server/transcript-stream-runtime.js";

export function createStreamGetHandler(dependencies = {}) {
  const applyRateLimit = dependencies.enforceRateLimit ?? enforceRateLimit;
  const resolveViewerContext = dependencies.resolveSessionViewerContext ?? resolveSessionViewerContext;
  const listMessages = dependencies.listSessionMessages ?? listSessionMessages;
  const subscribeMessages = dependencies.createSessionMessageSubscription ?? createSessionMessageSubscription;
  const setTimer = dependencies.setTimer ?? ((callback, interval) => setInterval(callback, interval));
  const clearTimer = dependencies.clearTimer ?? ((timerId) => clearInterval(timerId));
  const resolveClientAddress = dependencies.getClientAddress ?? getClientAddress;
  const reserveConnectionSlot = dependencies.acquireStreamConnectionSlot ?? acquireStreamConnectionSlot;
  const logStreamEvent = dependencies.logStreamEvent ?? logServerStreamTelemetry;

  return async function GET(request, { params }) {
    return runSessionRoute({
      request,
      params,
      fallbackCode: "stream_failed",
      onError: (error, _fallbackCode, context = {}) => {
        const apiError = toPublicApiError(error, "stream_failed");
        logStreamEvent("error", {
          event: "stream_connect_failed",
          session_id: context.sessionId ?? "unknown",
          ...getServerStreamErrorDetails(error)
        });

        return new Response(JSON.stringify({ error: apiError.code, message: apiError.message }), {
          status: apiError.status,
          headers: {
            "content-type": "application/json"
          }
        });
      },
      run: async ({ sessionId }) => {
        await applyRateLimit(request, buildRateLimitPolicy("sessionStreamConnect", sessionId));

        const url = new URL(request.url);
        const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get("limit") || "150", 10), 1), 300);
        const clientAddress = resolveClientAddress(request);

        const viewerContext = await resolveViewerContext(request, sessionId);
        const connectionSlot = reserveConnectionSlot({
          request,
          sessionId,
          clientAddress
        });
        logStreamEvent("info", {
          event: "stream_connection_slot_acquired",
          session_id: sessionId,
          viewer_role: viewerContext.role,
          client_address: clientAddress,
          active_connections_for_key: connectionSlot.keyCount,
          active_connections_for_session: connectionSlot.sessionCount
        });

        try {
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

          let streamClosed = false;
          const closeRuntime = async (reason) => {
            if (streamClosed) {
              return;
            }
            streamClosed = true;
            try {
              await runtime.close(reason);
            } finally {
              const counts = connectionSlot.release();
              logStreamEvent("info", {
                event: "stream_connection_slot_released",
                session_id: sessionId,
                viewer_role: viewerContext.role,
                client_address: clientAddress,
                reason,
                active_connections_for_key: counts.keyCount,
                active_connections_for_session: counts.sessionCount
              });
            }
          };

          logStreamEvent("info", {
            event: "stream_connect",
            session_id: sessionId,
            viewer_role: viewerContext.role,
            visibility: viewerContext.visibility,
            limit
          });

          request.signal.addEventListener("abort", () => {
            void closeRuntime("client_abort");
          });

          return new Response(stream.readable, {
            headers: {
              "content-type": "text/event-stream; charset=utf-8",
              "cache-control": "no-cache, no-transform",
              connection: "keep-alive",
              "x-stream-transport-mode": runtime.transportMode ?? "none"
            }
          });
        } catch (error) {
          const counts = connectionSlot.release();
          logStreamEvent("warn", {
            event: "stream_connection_slot_released",
            session_id: sessionId,
            viewer_role: viewerContext.role,
            client_address: clientAddress,
            reason: "runtime_start_failed",
            active_connections_for_key: counts.keyCount,
            active_connections_for_session: counts.sessionCount
          });
          throw error;
        }
      }
    });
  };
}

export const GET = createStreamGetHandler();
