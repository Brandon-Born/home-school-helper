import { ApiError } from "./api-error.js";
import {
  synthesizeWithGoogleTts,
  transcribeWithGoogleSpeech
} from "./google-speech.js";
import { getServerVoiceErrorDetails, logServerVoiceMetric, logServerVoiceTelemetry } from "./voice-telemetry.js";

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const RETRYABLE_CODES = new Set([
  "speech_provider_timeout",
  "speech_provider_unavailable",
  "speech_provider_rate_limited",
  "speech_provider_failed"
]);

function parseBoundedInt(rawValue, fallbackValue, min, max) {
  const parsed = Number.parseInt(String(rawValue ?? ""), 10);
  if (!Number.isFinite(parsed)) {
    return fallbackValue;
  }

  return Math.min(max, Math.max(min, parsed));
}

const DEFAULT_RELIABILITY_BY_OPERATION = Object.freeze({
  transcribe: Object.freeze({
    timeoutMs: 12000,
    maxRetries: 1,
    retryBaseDelayMs: 250
  }),
  synthesize: Object.freeze({
    timeoutMs: 6000,
    maxRetries: 0,
    retryBaseDelayMs: 250
  })
});

function getReliabilityConfig(env = process.env, operation) {
  const defaults = DEFAULT_RELIABILITY_BY_OPERATION[operation] ?? DEFAULT_RELIABILITY_BY_OPERATION.transcribe;
  const operationPrefix = operation === "synthesize" ? "SPEECH_SYNTH" : "SPEECH_TRANSCRIBE";

  return {
    timeoutMs: parseBoundedInt(
      env[`${operationPrefix}_TIMEOUT_MS`] ?? env.SPEECH_REQUEST_TIMEOUT_MS,
      defaults.timeoutMs,
      100,
      60000
    ),
    maxRetries: parseBoundedInt(
      env[`${operationPrefix}_MAX_RETRIES`] ?? env.SPEECH_MAX_RETRIES,
      defaults.maxRetries,
      0,
      3
    ),
    retryBaseDelayMs: parseBoundedInt(
      env[`${operationPrefix}_RETRY_BASE_DELAY_MS`] ?? env.SPEECH_RETRY_BASE_DELAY_MS,
      defaults.retryBaseDelayMs,
      25,
      3000
    )
  };
}

function normalizeProviderError(error, { operation, timeoutMs }) {
  if (error instanceof ApiError) {
    return error;
  }

  if (error && typeof error === "object" && error.name === "AbortError") {
    return new ApiError(504, "speech_provider_timeout", `Speech ${operation} timed out after ${timeoutMs}ms.`);
  }

  const message = error instanceof Error ? error.message : "";
  if (/network|fetch failed|econnreset|etimedout|enotfound|socket/i.test(message)) {
    return new ApiError(503, "speech_provider_unavailable", "Speech provider is temporarily unavailable.");
  }

  return new ApiError(502, "speech_provider_failed", `Speech ${operation} failed.`);
}

function isRetryableError(error) {
  if (!(error instanceof ApiError)) {
    return false;
  }

  return RETRYABLE_STATUSES.has(error.status) || RETRYABLE_CODES.has(error.code);
}

async function sleep(ms) {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function invokeSpeechOperation(provider, operation, input, env = process.env) {
  const config = getReliabilityConfig(env, operation);
  if (typeof provider?.[operation] !== "function") {
    throw new ApiError(500, "speech_provider_config_invalid", `Speech provider does not support ${operation}.`);
  }
  const providerName = String(provider?.name || "unknown");

  for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
    const startedAtMs = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, config.timeoutMs);

    try {
      const result = await provider[operation]({
        ...input,
        signal: controller.signal
      });
      clearTimeout(timeout);

      const durationMs = Date.now() - startedAtMs;
      logServerVoiceMetric(
        "speech_request_success",
        {
          operation,
          provider: providerName,
          status: attempt > 0 ? "ok_after_retry" : "ok",
          attempt: attempt + 1,
          retries_used: attempt,
          duration_ms: durationMs
        },
        { env }
      );

      return result;
    } catch (rawError) {
      clearTimeout(timeout);
      const error = normalizeProviderError(rawError, {
        operation,
        timeoutMs: config.timeoutMs
      });
      const shouldRetry = attempt < config.maxRetries && isRetryableError(error);
      const durationMs = Date.now() - startedAtMs;

      logServerVoiceTelemetry(
        shouldRetry ? "warn" : "error",
        {
          event: "speech_request",
          operation,
          provider: providerName,
          status: shouldRetry ? "retrying" : "failed",
          attempt: attempt + 1,
          retries_used: attempt,
          duration_ms: durationMs,
          ...getServerVoiceErrorDetails(error)
        },
        { env }
      );
      if (error.code === "speech_provider_timeout") {
        logServerVoiceMetric(
          "speech_provider_timeout",
          {
            operation,
            provider: providerName,
            attempt: attempt + 1
          },
          { level: "warn", env }
        );
      }

      if (!shouldRetry) {
        throw error;
      }

      const retryDelayMs = Math.min(config.retryBaseDelayMs * 2 ** attempt, 2000);
      logServerVoiceMetric(
        "speech_request_retry",
        {
          operation,
          provider: providerName,
          attempt: attempt + 1,
          retry_delay_ms: retryDelayMs,
          ...getServerVoiceErrorDetails(error)
        },
        { level: "warn", env }
      );
      await sleep(retryDelayMs);
    }
  }

  throw new ApiError(502, "speech_provider_failed", `Speech ${operation} failed after retries.`);
}

function buildGoogleProvider() {
  return {
    name: "google",
    async transcribe({ audioBytes, languageCode, signal }) {
      return transcribeWithGoogleSpeech({ audioBytes, languageCode, signal });
    },
    async synthesize({ text, speakingRate, signal }) {
      return synthesizeWithGoogleTts({ text, speakingRate, signal });
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
  return invokeSpeechOperation(provider, "transcribe", input, options.env);
}

export async function synthesizeSpeech(input, options = {}) {
  const provider = options.provider ?? getSpeechProvider(options.env);
  return invokeSpeechOperation(provider, "synthesize", input, options.env);
}
