import test from "node:test";
import assert from "node:assert/strict";

import { getVoiceErrorDetails } from "../src/lib/voice-telemetry.js";
import { getServerVoiceErrorDetails } from "../src/server/voice-telemetry.js";

test("getVoiceErrorDetails extracts structured client voice error fields", () => {
  const details = getVoiceErrorDetails({
    name: "ApiRequestError",
    code: "speech_provider_timeout",
    status: 504,
    message: "timed out"
  });

  assert.deepEqual(details, {
    error_name: "ApiRequestError",
    error_code: "speech_provider_timeout",
    error_status: 504,
    error_message: "timed out"
  });
});

test("getServerVoiceErrorDetails extracts structured server voice error fields", () => {
  const details = getServerVoiceErrorDetails({
    name: "ApiError",
    code: "speech_provider_unavailable",
    status: 503,
    message: "provider down"
  });

  assert.deepEqual(details, {
    error_name: "ApiError",
    error_code: "speech_provider_unavailable",
    error_status: 503,
    error_message: "provider down"
  });
});
