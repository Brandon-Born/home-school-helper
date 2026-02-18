import { requireChildSessionContext } from "../../../../../../src/server/auth.js";
import { handleRouteError } from "../../../../../../src/server/route-errors.js";
import { synthesizeSpeech } from "../../../../../../src/server/speech-provider.js";
import { enforceRateLimit } from "../../../../../../src/server/rate-limit.js";
import { buildRateLimitPolicy } from "../../../../../../src/server/rate-limit-policies.js";
import { parseSpeechSynthesizeInput } from "../../../../../../src/server/speech-route-validators.js";

export function createSpeechSynthesizePostHandler(dependencies = {}) {
  const applyRateLimit = dependencies.enforceRateLimit ?? enforceRateLimit;
  const requireChild = dependencies.requireChildSessionContext ?? requireChildSessionContext;
  const synthesize = dependencies.synthesizeSpeech ?? synthesizeSpeech;
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
      applyRateLimit(request, buildRateLimitPolicy("speechSynthesize", sessionId));

      await requireChild(request, sessionId);
      const input = await parseSpeechSynthesizeInput(request);
      const audioBuffer = await synthesize(input);

      return new Response(audioBuffer, {
        status: 200,
        headers: {
          "content-type": "audio/mpeg",
          "cache-control": "no-store"
        }
      });
    } catch (error) {
      logFailure({
        route: "speech_synthesize",
        session_id: sessionId,
        status: error?.status ?? 500,
        code: error?.code ?? "speech_synthesize_failed"
      });
      return onError(error, "speech_synthesize_failed");
    }
  };
}

export const POST = createSpeechSynthesizePostHandler();
