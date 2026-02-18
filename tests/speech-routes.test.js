import test from "node:test";
import assert from "node:assert/strict";

import { ApiError } from "../src/server/api-error.js";
import { createSpeechTranscribePostHandler } from "../app/api/session/[id]/speech/transcribe/route.js";
import { createSpeechSynthesizePostHandler } from "../app/api/session/[id]/speech/synthesize/route.js";
import {
  assertApiErrorResponse,
  createAudioFormRequest,
  createJsonRequest
} from "./helpers/route-test-helpers.js";

const originalSpeechTelemetrySetting = process.env.SPEECH_TELEMETRY_DISABLED;
process.env.SPEECH_TELEMETRY_DISABLED = "1";
test.after(() => {
  process.env.SPEECH_TELEMETRY_DISABLED = originalSpeechTelemetrySetting;
});

test("createSpeechTranscribePostHandler surfaces speech provider failures", async () => {
  const handler = createSpeechTranscribePostHandler({
    enforceRateLimit: () => {},
    logSpeechEvent: () => {},
    logSpeechFailure: () => {},
    requireChildSessionContext: async () => ({
      tokenRow: { child_id: "child_1" }
    }),
    transcribeSpeech: async () => {
      throw new ApiError(503, "speech_provider_unavailable", "Speech provider unavailable.");
    }
  });

  const response = await handler(createAudioFormRequest("https://example.test/api/session/s1/speech/transcribe"), {
    params: { id: "s1" }
  });

  await assertApiErrorResponse(response, {
    status: 503,
    error: "speech_provider_unavailable",
    message: "Speech provider unavailable."
  });
});

test("createSpeechTranscribePostHandler returns rate_limited when limiter rejects", async () => {
  const handler = createSpeechTranscribePostHandler({
    enforceRateLimit: () => {
      throw new ApiError(429, "rate_limited", "Too many requests. Please try again shortly.");
    },
    logSpeechEvent: () => {},
    logSpeechFailure: () => {}
  });

  const response = await handler(new Request("https://example.test/api/session/s1/speech/transcribe", { method: "POST" }), {
    params: { id: "s1" }
  });

  await assertApiErrorResponse(response, {
    status: 429,
    error: "rate_limited",
    message: "Too many requests. Please try again shortly."
  });
});

test("createSpeechSynthesizePostHandler surfaces speech provider failures", async () => {
  const handler = createSpeechSynthesizePostHandler({
    enforceRateLimit: () => {},
    logSpeechEvent: () => {},
    logSpeechFailure: () => {},
    requireChildSessionContext: async () => ({
      tokenRow: { child_id: "child_1" }
    }),
    synthesizeSpeech: async () => {
      throw new ApiError(503, "speech_provider_unavailable", "Speech provider unavailable.");
    }
  });

  const response = await handler(
    createJsonRequest("https://example.test/api/session/s1/speech/synthesize", { text: "Hello" }),
    { params: { id: "s1" } }
  );

  await assertApiErrorResponse(response, {
    status: 503,
    error: "speech_provider_unavailable",
    message: "Speech provider unavailable."
  });
});

test("createSpeechSynthesizePostHandler returns rate_limited when limiter rejects", async () => {
  const handler = createSpeechSynthesizePostHandler({
    enforceRateLimit: () => {
      throw new ApiError(429, "rate_limited", "Too many requests. Please try again shortly.");
    },
    logSpeechEvent: () => {},
    logSpeechFailure: () => {}
  });

  const response = await handler(
    createJsonRequest("https://example.test/api/session/s1/speech/synthesize", { text: "Hello" }),
    { params: { id: "s1" } }
  );

  await assertApiErrorResponse(response, {
    status: 429,
    error: "rate_limited",
    message: "Too many requests. Please try again shortly."
  });
});
