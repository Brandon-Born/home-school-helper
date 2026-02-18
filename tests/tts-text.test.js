import test from "node:test";
import assert from "node:assert/strict";

import { normalizeTextForSpeech } from "../src/server/tts-text.js";

test("normalizeTextForSpeech strips markdown markers and emoji", () => {
  const normalized = normalizeTextForSpeech("## Title 🙂\n- Use `x + y`.\n[help](https://example.test)");
  assert.equal(normalized, "Title Use x + y. help");
});

test("normalizeTextForSpeech removes fenced code blocks", () => {
  const normalized = normalizeTextForSpeech("Try this:\n```js\nconst x = 2;\n```\nThen explain.");
  assert.equal(normalized, "Try this: Then explain.");
});
