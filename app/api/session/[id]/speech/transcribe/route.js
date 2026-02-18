import { requireChildSessionContext } from "../../../../../../src/server/auth.js";
import { handleRouteError } from "../../../../../../src/server/route-errors.js";
import { transcribeSpeech } from "../../../../../../src/server/speech-provider.js";
import { enforceRateLimit } from "../../../../../../src/server/rate-limit.js";
import { buildRateLimitPolicy } from "../../../../../../src/server/rate-limit-policies.js";
import { parseSpeechTranscribeInput } from "../../../../../../src/server/speech-route-validators.js";
import {
  getServerVoiceErrorDetails,
  logServerVoiceMetric,
  logServerVoiceTelemetry
} from "../../../../../../src/server/voice-telemetry.js";

export function createSpeechTranscribePostHandler(dependencies = {}) {
  const applyRateLimit = dependencies.enforceRateLimit ?? enforceRateLimit;
  const requireChild = dependencies.requireChildSessionContext ?? requireChildSessionContext;
  const transcribe = dependencies.transcribeSpeech ?? transcribeSpeech;
  const onError = dependencies.handleRouteError ?? handleRouteError;
  const logSpeechEvent = dependencies.logSpeechEvent ?? logServerVoiceTelemetry;
  const logFailure =
    dependencies.logSpeechFailure ??
    ((payload) => {
      logServerVoiceMetric("speech_route_failed", payload, { level: "warn" });
    });

  return async function POST(request, { params }) {
    let sessionId = "unknown";
    const startedAtMs = Date.now();
    try {
      ({ id: sessionId } = await params);
      await applyRateLimit(request, buildRateLimitPolicy("speechTranscribe", sessionId));

      await requireChild(request, sessionId);
      const input = await parseSpeechTranscribeInput(request);
      const result = await transcribe(input);
      logServerVoiceMetric("speech_route_success", {
        route: "speech_transcribe",
        session_id: sessionId,
        duration_ms: Date.now() - startedAtMs
      });

      return Response.json(result);
    } catch (error) {
      const payload = {
        route: "speech_transcribe",
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
        route: "speech_transcribe",
        session_id: sessionId,
        status: error?.status ?? 500,
        code: error?.code ?? "speech_transcribe_failed"
      });
      return onError(error, "speech_transcribe_failed");
    }
  };
}

export const POST = createSpeechTranscribePostHandler();
