import { ApiRequestError } from "../../../../src/lib/http.js";

export function classifySpeechFailure(error, fallbackMessage) {
  if (error instanceof ApiRequestError) {
    if (error.status === 429 || error.code === "speech_provider_rate_limited") {
      return "Voice is busy right now. Try again in a few seconds, or type your question.";
    }

    if (error.code === "speech_provider_timeout") {
      return "Voice took too long. Try again, or type your question.";
    }

    if (error.status >= 500 || error.code === "speech_provider_unavailable") {
      return "Voice is temporarily unavailable. You can keep going by typing.";
    }
  }

  const message = error instanceof Error ? error.message : "";
  if (/timeout|timed out/i.test(message)) {
    return "Voice took too long. Try again, or type your question.";
  }

  return fallbackMessage;
}
