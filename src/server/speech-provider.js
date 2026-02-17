import { ApiError } from "./api-error.js";
import {
  synthesizeWithGoogleTts,
  transcribeWithGoogleSpeech
} from "./google-speech.js";

function buildGoogleProvider() {
  return {
    name: "google",
    async transcribe({ audioBytes, languageCode }) {
      return transcribeWithGoogleSpeech({ audioBytes, languageCode });
    },
    async synthesize({ text, speakingRate }) {
      return synthesizeWithGoogleTts({ text, speakingRate });
    }
  };
}

export function getSpeechProvider(env = process.env) {
  const providerName = String(env.SPEECH_PROVIDER || "google").trim().toLowerCase();

  if (providerName === "google") {
    return buildGoogleProvider();
  }

  throw new ApiError(500, "speech_provider_config_invalid", `Unsupported speech provider: ${providerName}`);
}

export async function transcribeSpeech(input, options = {}) {
  const provider = options.provider ?? getSpeechProvider(options.env);
  return provider.transcribe(input);
}

export async function synthesizeSpeech(input, options = {}) {
  const provider = options.provider ?? getSpeechProvider(options.env);
  return provider.synthesize(input);
}
