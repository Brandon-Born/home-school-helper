import test from "node:test";
import assert from "node:assert/strict";

import { runSessionTutorTurn } from "../src/server/session-turn-orchestrator.js";

test("runSessionTutorTurn orchestrates generation, persistence, and audit logging", async () => {
  const calls = {
    generate: null,
    persist: [],
    audit: null
  };

  const result = await runSessionTutorTurn(
    {
      sessionId: "session_1",
      source: "child-turn",
      studentInput: "Can you help me solve this?",
      parentGuidance: "Keep it scaffolded",
      profile: { first_name: "Ava" },
      dailyContext: { daily_subjects: ["Math"] },
      allowDirectAnswer: false,
      inputActorType: "child",
      inputVisibilityScope: "child_and_parent"
    },
    {
      generateTutorTurn: async (args) => {
        calls.generate = args;
        return {
          assistant_text: "Let's work through this step by step.",
          speak_payload: {
            text: "Let's work through this step by step.",
            voice: "default",
            mode: "hybrid_tts"
          },
          policy_applied: ["none"],
          model_used: "claude-test"
        };
      },
      persistSessionMessage: async (args) => {
        calls.persist.push(args);
      },
      persistTutorAuditEvents: async (args) => {
        calls.audit = args;
      },
      getTutorConfig: () => ({
        promptVersion: "v1"
      })
    }
  );

  assert.equal(result.assistant_text, "Let's work through this step by step.");
  assert.equal(calls.generate.source, "child-turn");
  assert.equal(calls.persist.length, 2);
  assert.equal(calls.persist[0].actorType, "child");
  assert.equal(calls.persist[1].actorType, "assistant");
  assert.deepEqual(calls.audit, {
    sessionId: "session_1",
    source: "child-turn",
    modelUsed: "claude-test",
    promptVersion: "v1",
    policyApplied: ["none"]
  });
});
