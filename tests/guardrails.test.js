import test from "node:test";
import assert from "node:assert/strict";
import { applyTutorGuardrails } from "../src/server/guardrails.js";

test("scaffold-first rewrites direct answers when override is disabled", () => {
  const result = applyTutorGuardrails({
    assistantText: "The answer is 42.",
    studentPrompt: "What is 6 times 7?",
    allowDirectAnswer: false
  });

  assert.match(result.assistantText, /work through|step by step/i);
  assert.ok(result.policyApplied.includes("scaffold_rewrite"));
});

test("parent override allows direct answers", () => {
  const result = applyTutorGuardrails({
    assistantText: "The answer is 42.",
    studentPrompt: "What is 6 times 7?",
    allowDirectAnswer: true
  });

  assert.equal(result.assistantText, "The answer is 42.");
  assert.deepEqual(result.policyApplied, ["none"]);
});
