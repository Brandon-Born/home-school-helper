import { requireChildSessionContext } from "../../../../../../src/server/auth.js";
import { ApiError } from "../../../../../../src/server/api-error.js";
import { handleRouteError } from "../../../../../../src/server/route-errors.js";
import { transcribeSpeech } from "../../../../../../src/server/speech-provider.js";

export async function POST(request, { params }) {
  try {
    await requireChildSessionContext(request, params.id);

    const formData = await request.formData();
    const audioFile = formData.get("audio");

    if (!audioFile || typeof audioFile.arrayBuffer !== "function") {
      throw new ApiError(400, "validation_error", "audio file is required.");
    }

    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
    if (audioBuffer.length === 0) {
      throw new ApiError(400, "validation_error", "audio file must not be empty.");
    }

    const languageCode = formData.get("language_code");
    const result = await transcribeSpeech({
      audioBytes: audioBuffer,
      languageCode: typeof languageCode === "string" ? languageCode : undefined
    });

    return Response.json(result);
  } catch (error) {
    return handleRouteError(error, "speech_transcribe_failed");
  }
}
