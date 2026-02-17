import { ApiRequestError } from "../../../../src/lib/http.js";

export function classifySpeechFailure(error, fallbackMessage) {
  if (error instanceof ApiRequestError) {
    if (error.status === 429 || error.code === "speech_provider_rate_limited") {
      return "Voice service is busy. Try again in a few seconds or type your question.";
    }

    if (error.code === "speech_provider_timeout") {
      return "Voice service timed out. Try again, or type your question.";
    }

    if (error.status >= 500 || error.code === "speech_provider_unavailable") {
      return "Voice service is temporarily unavailable. You can keep going in text mode.";
    }
  }

  const message = error instanceof Error ? error.message : "";
  if (/timeout|timed out/i.test(message)) {
    return "Voice service timed out. Try again, or type your question.";
  }

  return fallbackMessage;
}
