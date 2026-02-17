import test from "node:test";
import assert from "node:assert/strict";

import { ApiError } from "../src/server/api-error.js";
import {
  getSpeechProvider,
  synthesizeSpeech,
  transcribeSpeech
} from "../src/server/speech-provider.js";

test("getSpeechProvider defaults to google provider", () => {
  const provider = getSpeechProvider({});
  assert.equal(provider.name, "google");
  assert.equal(typeof provider.transcribe, "function");
  assert.equal(typeof provider.synthesize, "function");
});

test("getSpeechProvider rejects unknown providers", () => {
  assert.throws(
    () => getSpeechProvider({ SPEECH_PROVIDER: "other" }),
    (error) => error instanceof ApiError && error.code === "speech_provider_config_invalid"
  );
});

test("transcribeSpeech delegates to injected provider", async () => {
  const provider = {
    name: "fake",
    transcribe: async ({ languageCode }) => ({ transcript: `ok-${languageCode}` })
  };

  const result = await transcribeSpeech({ audioBytes: Buffer.from("abc"), languageCode: "en-US" }, { provider });
  assert.deepEqual(result, { transcript: "ok-en-US" });
});

test("synthesizeSpeech delegates to injected provider", async () => {
  const provider = {
    name: "fake",
    synthesize: async ({ text }) => Buffer.from(`audio:${text}`)
  };

  const result = await synthesizeSpeech({ text: "hello" }, { provider });
  assert.equal(result.toString("utf8"), "audio:hello");
});

test("transcribeSpeech retries transient provider failures", async () => {
  let attempts = 0;
  const provider = {
    name: "fake",
    transcribe: async () => {
      attempts += 1;
      if (attempts < 2) {
        throw new ApiError(503, "speech_provider_unavailable", "try again");
      }

      return { transcript: "ok" };
    }
  };

  const result = await transcribeSpeech(
    { audioBytes: Buffer.from("abc"), languageCode: "en-US" },
    {
      provider,
      env: {
        SPEECH_MAX_RETRIES: "2",
        SPEECH_RETRY_BASE_DELAY_MS: "1",
        SPEECH_TELEMETRY_DISABLED: "1"
      }
    }
  );

  assert.equal(attempts, 2);
  assert.deepEqual(result, { transcript: "ok" });
});

test("synthesizeSpeech does not retry validation errors", async () => {
  let attempts = 0;
  const provider = {
    name: "fake",
    synthesize: async () => {
      attempts += 1;
      throw new ApiError(400, "validation_error", "bad input");
    }
  };

  await assert.rejects(
    () =>
      synthesizeSpeech(
        { text: "hello" },
        {
          provider,
          env: {
            SPEECH_MAX_RETRIES: "3",
            SPEECH_RETRY_BASE_DELAY_MS: "1",
            SPEECH_TELEMETRY_DISABLED: "1"
          }
        }
      ),
    (error) => error instanceof ApiError && error.code === "validation_error"
  );

  assert.equal(attempts, 1);
});

test("transcribeSpeech maps provider timeouts to timeout api error", async () => {
  const provider = {
    name: "fake",
    transcribe: async ({ signal }) =>
      new Promise((resolve, reject) => {
        signal.addEventListener("abort", () => {
          const timeoutError = new Error("timed out");
          timeoutError.name = "AbortError";
          reject(timeoutError);
        });
      })
  };

  await assert.rejects(
    () =>
      transcribeSpeech(
        { audioBytes: Buffer.from("abc"), languageCode: "en-US" },
        {
          provider,
          env: {
            SPEECH_REQUEST_TIMEOUT_MS: "10",
            SPEECH_MAX_RETRIES: "0",
            SPEECH_TELEMETRY_DISABLED: "1"
          }
        }
      ),
    (error) =>
      error instanceof ApiError && error.status === 504 && error.code === "speech_provider_timeout"
  );
});
