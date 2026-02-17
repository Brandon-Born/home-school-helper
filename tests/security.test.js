import test from "node:test";
import assert from "node:assert/strict";
import { assertServerOnly } from "../src/server/anthropic.js";
import { generateTutorTurn } from "../src/server/tutor-service.js";

test("anthropic caller cannot run in browser context", () => {
  global.window = {};

  assert.throws(() => assertServerOnly(), /server only/i);

  delete global.window;
});

test("tutor API result does not leak api key", async () => {
  const apiKey = "super_secret_key";

  const result = await generateTutorTurn({
    sessionId: "session_1",
    source: "child-turn",
    studentInput: "Can you help me with fractions?",
    allowDirectAnswer: false,
    configOverride: {
      apiKey,
      model: "claude-test",
      maxTokens: 128,
      temperature: 0.2,
      promptVersion: "test"
    },
    modelCaller: async () => ({ text: "Start by finding a common denominator." })
  });

  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes(apiKey), false);
  assert.equal("model_used" in result, true);
  assert.equal("assistant_text" in result, true);
  assert.equal("speak_payload" in result, true);
  assert.equal("policy_applied" in result, true);
});
