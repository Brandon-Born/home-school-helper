import test from "node:test";
import assert from "node:assert/strict";

import { ApiError } from "../src/server/api-error.js";
import {
  parseSpeechSynthesizeInput,
  parseSpeechTranscribeInput
} from "../src/server/speech-route-validators.js";

test("parseSpeechTranscribeInput requires a non-empty audio file", async () => {
  const missingAudioForm = new FormData();
  missingAudioForm.append("language_code", "en-US");

  await assert.rejects(
    () =>
      parseSpeechTranscribeInput(
        new Request("https://example.test/transcribe", {
          method: "POST",
          body: missingAudioForm
        })
      ),
    (error) =>
      error instanceof ApiError &&
      error.status === 400 &&
      error.code === "validation_error" &&
      error.message === "audio file is required."
  );

  const emptyAudioForm = new FormData();
  emptyAudioForm.append("audio", new Blob([]), "empty.webm");

  await assert.rejects(
    () =>
      parseSpeechTranscribeInput(
        new Request("https://example.test/transcribe", {
          method: "POST",
          body: emptyAudioForm
        })
      ),
    (error) =>
      error instanceof ApiError &&
      error.status === 400 &&
      error.code === "validation_error" &&
      error.message === "audio file must not be empty."
  );
});

test("parseSpeechTranscribeInput returns decoded bytes and language code", async () => {
  const formData = new FormData();
  formData.append("audio", new Blob(["abc123"], { type: "audio/webm" }), "sample.webm");
  formData.append("language_code", "en-US");

  const parsed = await parseSpeechTranscribeInput(
    new Request("https://example.test/transcribe", {
      method: "POST",
      body: formData
    })
  );

  assert.equal(Buffer.isBuffer(parsed.audioBytes), true);
  assert.equal(parsed.audioBytes.toString("utf8"), "abc123");
  assert.equal(parsed.languageCode, "en-US");
});

test("parseSpeechSynthesizeInput requires text and clamps speaking rate", async () => {
  await assert.rejects(
    () =>
      parseSpeechSynthesizeInput(
        new Request("https://example.test/synthesize", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: "   " })
        })
      ),
    (error) =>
      error instanceof ApiError &&
      error.status === 400 &&
      error.code === "validation_error" &&
      error.message === "text is required."
  );

  const fast = await parseSpeechSynthesizeInput(
    new Request("https://example.test/synthesize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Hello", speaking_rate: 9 })
    })
  );
  assert.equal(fast.speakingRate, 1.2);

  const slow = await parseSpeechSynthesizeInput(
    new Request("https://example.test/synthesize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Hello", speaking_rate: 0.1 })
    })
  );
  assert.equal(slow.speakingRate, 0.8);
});

test("parseSpeechSynthesizeInput normalizes markdown-style text for speech", async () => {
  const parsed = await parseSpeechSynthesizeInput(
    new Request("https://example.test/synthesize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "## Hi 🙂\n- Use `fractions` first." })
    })
  );

  assert.equal(parsed.text.includes("##"), false);
  assert.equal(parsed.text.includes("🙂"), false);
  assert.equal(parsed.text.includes("`"), false);
  assert.equal(parsed.text, "Hi Use fractions first.");
});
