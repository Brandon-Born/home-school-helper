import test from "node:test";
import assert from "node:assert/strict";

import { ApiRequestError } from "../src/lib/http.js";
import { shouldCooldownCloudTts } from "../app/child/hooks/voice/cloud-tts-policy.js";

test("shouldCooldownCloudTts returns true for retryable provider API failures", () => {
  assert.equal(
    shouldCooldownCloudTts(
      new ApiRequestError("Service unavailable", {
        status: 503,
        code: "speech_provider_unavailable"
      })
    ),
    true
  );

  assert.equal(
    shouldCooldownCloudTts(
      new ApiRequestError("Timed out", {
        status: 504,
        code: "speech_provider_timeout"
      })
    ),
    true
  );

  assert.equal(
    shouldCooldownCloudTts(
      new ApiRequestError("Rate limited", {
        status: 429,
        code: "speech_provider_rate_limited"
      })
    ),
    true
  );
});

test("shouldCooldownCloudTts returns false for non-retryable request errors", () => {
  assert.equal(
    shouldCooldownCloudTts(
      new ApiRequestError("Bad input", {
        status: 400,
        code: "speech_text_required"
      })
    ),
    false
  );
});

test("shouldCooldownCloudTts handles generic error messages", () => {
  assert.equal(shouldCooldownCloudTts(new Error("Speech service unavailable")), true);
  assert.equal(shouldCooldownCloudTts(new Error("Audio playback blocked by browser")), false);
});
