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

  return async function POST(request, { params }) {
    try {
      applyRateLimit(request, buildRateLimitPolicy("speechSynthesize", params.id));

      await requireChild(request, params.id);
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
      return onError(error, "speech_synthesize_failed");
    }
  };
}

export const POST = createSpeechSynthesizePostHandler();
