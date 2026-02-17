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
