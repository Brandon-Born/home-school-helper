import { ApiRequestError } from "../../../../src/lib/http.js";

export const CLOUD_TTS_COOLDOWN_MS = 2 * 60 * 1000;

const RETRYABLE_CLOUD_TTS_CODES = new Set([
  "speech_provider_timeout",
  "speech_provider_unavailable",
  "speech_provider_rate_limited",
  "speech_provider_failed",
  "speech_provider_config_invalid",
  "speech_provider_auth_failed"
]);

export function shouldCooldownCloudTts(error) {
  if (error instanceof ApiRequestError) {
    if (typeof error.status === "number" && error.status >= 500) {
      return true;
    }

    if (error.status === 429) {
      return true;
    }

    if (error.code && RETRYABLE_CLOUD_TTS_CODES.has(error.code)) {
      return true;
    }
  }

  const message = error instanceof Error ? error.message : "";
  return /timed out|timeout|temporarily unavailable|unavailable|service unavailable/i.test(message);
}
