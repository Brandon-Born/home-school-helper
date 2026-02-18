import { requireChildSessionContext } from "../../../../../../src/server/auth.js";
import { handleRouteError } from "../../../../../../src/server/route-errors.js";
import { transcribeSpeech } from "../../../../../../src/server/speech-provider.js";
import { enforceRateLimit } from "../../../../../../src/server/rate-limit.js";
import { buildRateLimitPolicy } from "../../../../../../src/server/rate-limit-policies.js";
import { parseSpeechTranscribeInput } from "../../../../../../src/server/speech-route-validators.js";

export function createSpeechTranscribePostHandler(dependencies = {}) {
  const applyRateLimit = dependencies.enforceRateLimit ?? enforceRateLimit;
  const requireChild = dependencies.requireChildSessionContext ?? requireChildSessionContext;
  const transcribe = dependencies.transcribeSpeech ?? transcribeSpeech;
  const onError = dependencies.handleRouteError ?? handleRouteError;
  const logFailure =
    dependencies.logSpeechFailure ??
    ((payload) => {
      console.warn("[speech-route]", JSON.stringify(payload));
    });

  return async function POST(request, { params }) {
    let sessionId = "unknown";
    try {
      ({ id: sessionId } = await params);
      applyRateLimit(request, buildRateLimitPolicy("speechTranscribe", sessionId));

      await requireChild(request, sessionId);
      const input = await parseSpeechTranscribeInput(request);
      const result = await transcribe(input);

      return Response.json(result);
    } catch (error) {
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
