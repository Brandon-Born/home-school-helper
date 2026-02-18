import { requireChildSessionContext } from "../../../../../../src/server/auth.js";
import { handleRouteError } from "../../../../../../src/server/route-errors.js";
import { synthesizeSpeech } from "../../../../../../src/server/speech-provider.js";
import { enforceRateLimit } from "../../../../../../src/server/rate-limit.js";
import { buildRateLimitPolicy } from "../../../../../../src/server/rate-limit-policies.js";
import { runSessionRoute } from "../../../../../../src/server/session-route-helpers.js";
import { parseSpeechSynthesizeInput } from "../../../../../../src/server/speech-route-validators.js";
import {
  getServerVoiceErrorDetails,
  logServerVoiceMetric,
  logServerVoiceTelemetry
} from "../../../../../../src/server/voice-telemetry.js";

export function createSpeechSynthesizePostHandler(dependencies = {}) {
  const applyRateLimit = dependencies.enforceRateLimit ?? enforceRateLimit;
  const requireChild = dependencies.requireChildSessionContext ?? requireChildSessionContext;
  const synthesize = dependencies.synthesizeSpeech ?? synthesizeSpeech;
  const onError = dependencies.handleRouteError ?? handleRouteError;
  const logSpeechEvent = dependencies.logSpeechEvent ?? logServerVoiceTelemetry;
  const logFailure =
    dependencies.logSpeechFailure ??
    ((payload) => {
      logServerVoiceMetric("speech_route_failed", payload, { level: "warn" });
    });

  return async function POST(request, { params }) {
    const startedAtMs = Date.now();
    return runSessionRoute({
      request,
      params,
      fallbackCode: "speech_synthesize_failed",
      onError,
      run: async ({ sessionId }) => {
        await applyRateLimit(request, buildRateLimitPolicy("speechSynthesize", sessionId));

        await requireChild(request, sessionId);
        const input = await parseSpeechSynthesizeInput(request);
        const audioBuffer = await synthesize(input);
        logServerVoiceMetric("speech_route_success", {
          route: "speech_synthesize",
          session_id: sessionId,
          duration_ms: Date.now() - startedAtMs
        });

        return new Response(audioBuffer, {
          status: 200,
          headers: {
            "content-type": "audio/mpeg",
            "cache-control": "no-store"
          }
        });
      },
      onRouteError: ({ error, sessionId }) => {
        const payload = {
          route: "speech_synthesize",
          session_id: sessionId,
          duration_ms: Date.now() - startedAtMs,
          ...getServerVoiceErrorDetails(error)
        };
        logSpeechEvent("warn", {
          event: "speech_route_request",
          status: "failed",
          ...payload
        });
        if (payload.error_code === "rate_limited") {
          logServerVoiceMetric("speech_route_rate_limited", payload, { level: "warn" });
        } else if (payload.error_code === "invalid_child_session_token" || payload.error_code === "missing_authorization") {
          logServerVoiceMetric("speech_route_auth_failed", payload, { level: "warn" });
        } else {
          logServerVoiceMetric("speech_route_failed", payload, { level: "warn" });
        }
        logFailure({
          route: "speech_synthesize",
          session_id: sessionId,
          status: error?.status ?? 500,
          code: error?.code ?? "speech_synthesize_failed"
        });
      }
    });
  };
}

export const POST = createSpeechSynthesizePostHandler();
