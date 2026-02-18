import { ApiError } from "./api-error.js";
import { normalizeTextForSpeech } from "./tts-text.js";

function clampSpeakingRate(rawValue) {
  const parsed = Number.parseFloat(String(rawValue ?? ""));
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return Math.min(1.2, Math.max(0.8, parsed));
}

export async function parseSpeechTranscribeInput(request) {
  const formData = await request.formData();
  const audioFile = formData.get("audio");

  if (!audioFile || typeof audioFile.arrayBuffer !== "function") {
    throw new ApiError(400, "validation_error", "audio file is required.");
  }

  const audioBytes = Buffer.from(await audioFile.arrayBuffer());
  if (audioBytes.length === 0) {
    throw new ApiError(400, "validation_error", "audio file must not be empty.");
  }

  const languageCode = formData.get("language_code");
  return {
    audioBytes,
    languageCode: typeof languageCode === "string" ? languageCode : undefined
  };
}

export async function parseSpeechSynthesizeInput(request) {
  const payload = await request.json();
  const text = normalizeTextForSpeech(payload?.text);
  if (!text) {
    throw new ApiError(400, "validation_error", "text is required.");
  }

  return {
    text,
    speakingRate: clampSpeakingRate(payload?.speaking_rate)
  };
}
