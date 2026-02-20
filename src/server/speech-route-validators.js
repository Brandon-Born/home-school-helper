import { ApiError } from "./api-error.js";
import { normalizeTextForSpeech } from "./tts-text.js";

const DEFAULT_MAX_TRANSCRIBE_AUDIO_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_SYNTH_TEXT_LENGTH = 2000;

function clampSpeakingRate(rawValue) {
  const parsed = Number.parseFloat(String(rawValue ?? ""));
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return Math.min(1.2, Math.max(0.8, parsed));
}

function parseBoundedInt(rawValue, fallbackValue, min, max) {
  const parsed = Number.parseInt(String(rawValue ?? ""), 10);
  if (!Number.isInteger(parsed)) {
    return fallbackValue;
  }
  return Math.min(max, Math.max(min, parsed));
}

function getSpeechPayloadLimits(env = process.env) {
  return {
    maxTranscribeAudioBytes: parseBoundedInt(
      env.SPEECH_TRANSCRIBE_MAX_AUDIO_BYTES,
      DEFAULT_MAX_TRANSCRIBE_AUDIO_BYTES,
      8 * 1024,
      20 * 1024 * 1024
    ),
    maxSynthesizeTextLength: parseBoundedInt(
      env.SPEECH_SYNTH_MAX_TEXT_LENGTH,
      DEFAULT_MAX_SYNTH_TEXT_LENGTH,
      200,
      20000
    )
  };
}

export async function parseSpeechTranscribeInput(request, options = {}) {
  const limits = getSpeechPayloadLimits(options.env);
  const formData = await request.formData();
  const audioFile = formData.get("audio");

  if (!audioFile || typeof audioFile.arrayBuffer !== "function") {
    throw new ApiError(400, "validation_error", "audio file is required.");
  }

  if (typeof audioFile.type === "string" && audioFile.type && !audioFile.type.toLowerCase().startsWith("audio/")) {
    throw new ApiError(400, "validation_error", "audio file must be an audio/* content type.");
  }

  const audioBytes = Buffer.from(await audioFile.arrayBuffer());
  if (audioBytes.length === 0) {
    throw new ApiError(400, "validation_error", "audio file must not be empty.");
  }

  if (audioBytes.length > limits.maxTranscribeAudioBytes) {
    throw new ApiError(
      413,
      "payload_too_large",
      `audio file must be <= ${limits.maxTranscribeAudioBytes} bytes.`
    );
  }

  const languageCode = formData.get("language_code");
  return {
    audioBytes,
    languageCode: typeof languageCode === "string" ? languageCode : undefined
  };
}

export async function parseSpeechSynthesizeInput(request, options = {}) {
  const limits = getSpeechPayloadLimits(options.env);
  const payload = await request.json();
  const text = normalizeTextForSpeech(payload?.text);
  if (!text) {
    throw new ApiError(400, "validation_error", "text is required.");
  }

  if (text.length > limits.maxSynthesizeTextLength) {
    throw new ApiError(
      413,
      "payload_too_large",
      `text must be at most ${limits.maxSynthesizeTextLength} characters.`
    );
  }

  return {
    text,
    speakingRate: clampSpeakingRate(payload?.speaking_rate)
  };
}
