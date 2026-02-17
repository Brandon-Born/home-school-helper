import { requireChildSessionContext } from "../../../../../../src/server/auth.js";
import { ApiError } from "../../../../../../src/server/api-error.js";
import { handleRouteError } from "../../../../../../src/server/route-errors.js";
import { synthesizeSpeech } from "../../../../../../src/server/speech-provider.js";
import { enforceRateLimit } from "../../../../../../src/server/rate-limit.js";

export function createSpeechSynthesizePostHandler(dependencies = {}) {
  const applyRateLimit = dependencies.enforceRateLimit ?? enforceRateLimit;
  const requireChild = dependencies.requireChildSessionContext ?? requireChildSessionContext;
  const synthesize = dependencies.synthesizeSpeech ?? synthesizeSpeech;
  const onError = dependencies.handleRouteError ?? handleRouteError;

  return async function POST(request, { params }) {
    try {
      applyRateLimit(request, {
        scope: "speech_synthesize",
        maxRequests: 35,
        windowMs: 60_000,
        keySuffix: params.id
      });

      await requireChild(request, params.id);

      const payload = await request.json();
      const text = String(payload?.text || "").trim();
      if (!text) {
        throw new ApiError(400, "validation_error", "text is required.");
      }

      const speakingRateValue = Number.parseFloat(String(payload?.speaking_rate ?? ""));
      const audioBuffer = await synthesize({
        text,
        speakingRate: Number.isFinite(speakingRateValue)
          ? Math.min(1.2, Math.max(0.8, speakingRateValue))
          : undefined
      });

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
