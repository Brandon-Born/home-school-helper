import { requireChildSessionContext } from "../../../../../../src/server/auth.js";
import { ApiError } from "../../../../../../src/server/api-error.js";
import { handleRouteError } from "../../../../../../src/server/route-errors.js";
import { synthesizeSpeech } from "../../../../../../src/server/speech-provider.js";

export async function POST(request, { params }) {
  try {
    await requireChildSessionContext(request, params.id);

    const payload = await request.json();
    const text = String(payload?.text || "").trim();
    if (!text) {
      throw new ApiError(400, "validation_error", "text is required.");
    }

    const speakingRateValue = Number.parseFloat(String(payload?.speaking_rate ?? ""));
    const audioBuffer = await synthesizeSpeech({
      text,
      speakingRate: Number.isFinite(speakingRateValue) ? speakingRateValue : undefined
    });

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        "content-type": "audio/mpeg",
        "cache-control": "no-store"
      }
    });
  } catch (error) {
    return handleRouteError(error, "speech_synthesize_failed");
  }
}
