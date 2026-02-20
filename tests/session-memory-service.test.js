import test from "node:test";
import assert from "node:assert/strict";

import {
  buildNextSessionMemory,
  updateSessionTutorMemory
} from "../src/server/session-foundation-service.js";
import { createFakeServiceClient } from "./helpers/fake-service-client.js";

test("buildNextSessionMemory rolls forward checkpoints and pending questions", () => {
  const next = buildNextSessionMemory({
    previousMemory: {
      turn_count: 2,
      subjects: ["Math"],
      key_checkpoints: ["Learner focus: fractions basics."],
      pending_questions: ["What is a denominator?"],
      summary: "Older summary"
    },
    source: "child-turn",
    learnerInput: "I still get stuck reducing 6/8.",
    assistantText: "Great effort. What factor divides both 6 and 8?",
    policyApplied: ["none"],
    dailyContext: {
      daily_subjects: ["Math", "Reading"]
    },
    updatedAt: "2026-02-20T20:30:00.000Z"
  });

  assert.equal(next.turn_count, 3);
  assert.deepEqual(next.subjects, ["Math", "Reading"]);
  assert.equal(next.updated_at, "2026-02-20T20:30:00.000Z");
  assert.equal(next.key_checkpoints.some((item) => item.includes("Learner focus:")), true);
  assert.equal(next.key_checkpoints.some((item) => item.includes("Tutor guidance:")), true);
  assert.equal(next.pending_questions.some((item) => item.includes("?")), true);
  assert.equal(next.summary.includes("Focus subjects: Math, Reading."), true);
});

test("buildNextSessionMemory avoids saving parent-only nudge text as learner focus", () => {
  const next = buildNextSessionMemory({
    previousMemory: null,
    source: "parent-nudge",
    learnerInput: "Parent private nudge text should stay private.",
    assistantText: "Let's take this one step at a time and compare fractions first.",
    policyApplied: ["none"],
    dailyContext: {
      daily_subjects: ["Math"]
    }
  });

  assert.equal(next.key_checkpoints.some((item) => item.includes("Learner focus:")), false);
  assert.equal(next.key_checkpoints.some((item) => item.includes("Tutor guidance:")), true);
});

test("updateSessionTutorMemory merges memory into daily_context without dropping existing fields", async () => {
  const serviceClient = createFakeServiceClient({
    sessions: [
      {
        id: "session_1",
        child_id: "child_1",
        parent_id: "parent_1",
        status: "active",
        daily_context: {
          daily_subjects: ["Math"],
          goal_notes: "Master equivalent fractions."
        }
      }
    ]
  });

  const memory = await updateSessionTutorMemory(
    {
      sessionId: "session_1",
      source: "child-turn",
      learnerInput: "Can you help me compare 1/2 and 3/4?",
      assistantText: "What common denominator could you use first?",
      policyApplied: ["none"],
      dailyContext: {
        daily_subjects: ["Math"]
      },
      updatedAt: "2026-02-20T20:31:00.000Z"
    },
    { serviceClient }
  );

  assert.equal(memory.turn_count, 1);
  const storedDailyContext = serviceClient.tables.sessions[0].daily_context;
  assert.equal(storedDailyContext.goal_notes, "Master equivalent fractions.");
  assert.equal(storedDailyContext.session_memory.turn_count, 1);
  assert.equal(storedDailyContext.session_memory.updated_at, "2026-02-20T20:31:00.000Z");
});
