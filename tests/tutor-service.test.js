import test from "node:test";
import assert from "node:assert/strict";

import { generateTutorTurn } from "../src/server/tutor-service.js";

const TEST_CONFIG = {
  apiKey: "fake",
  model: "claude-test",
  maxTokens: 128,
  temperature: 0.2,
  promptVersion: "test"
};

test("generateTutorTurn includes recent transcript context and compact profile after conversation starts", async () => {
  let recordedCall = null;

  const result = await generateTutorTurn({
    sessionId: "session_1",
    source: "child-turn",
    studentInput: "I still do not get fractions",
    parentGuidance: "Encourage confidence.",
    profile: {
      first_name: "Ava",
      age: 9,
      grade: "4",
      subjects: ["Math", "Science"],
      profile_notes: "Prefers concrete examples."
    },
    dailyContext: { daily_subjects: ["Math"] },
    sessionMemory: {
      summary: "Focus subjects: Math. Recent progression: Learner focus on denominators.",
      key_checkpoints: ["Learner focus: denominator mismatch", "Tutor guidance: compare denominators first"],
      pending_questions: ["What denominator can both fractions use?"]
    },
    recentMessages: [
      { actor_type: "assistant", content: "Ava, great start. What do you notice first?" },
      { actor_type: "child", content: "I notice the bottom numbers are different." }
    ],
    allowDirectAnswer: false,
    configOverride: TEST_CONFIG,
    modelCaller: async (payload) => {
      recordedCall = payload;
      return { text: "Nice observation. What should we do with the denominators?" };
    }
  });

  assert.equal(typeof result.assistant_text, "string");
  assert.ok(recordedCall);
  assert.equal(recordedCall.systemPrompt.includes("\"first_name\""), false);
  assert.equal(recordedCall.systemPrompt.includes("\"grade\":\"4\""), true);
  assert.equal(recordedCall.userPrompt.includes("Rolling session memory:"), true);
  assert.equal(recordedCall.userPrompt.includes("Focus subjects: Math."), true);
  assert.equal(recordedCall.userPrompt.includes("Recent visible transcript"), true);
  assert.equal(recordedCall.userPrompt.includes("Tutor: Ava, great start. What do you notice first?"), true);
  assert.equal(recordedCall.userPrompt.includes("Learner: I notice the bottom numbers are different."), true);
});

test("generateTutorTurn removes repeated leading learner-name salutation", async () => {
  const result = await generateTutorTurn({
    sessionId: "session_1",
    source: "child-turn",
    studentInput: "What do I do next?",
    parentGuidance: null,
    profile: {
      first_name: "Ava",
      grade: "4",
      subjects: ["Math"]
    },
    dailyContext: { daily_subjects: ["Math"] },
    recentMessages: [
      { actor_type: "assistant", content: "Ava, let's break it into steps." },
      { actor_type: "child", content: "Okay." }
    ],
    allowDirectAnswer: false,
    configOverride: TEST_CONFIG,
    modelCaller: async () => ({ text: "Ava, first compare the denominators." })
  });

  assert.equal(result.assistant_text, "first compare the denominators.");
});

test("generateTutorTurn uses parent-side framing for parent nudges", async () => {
  let recordedCall = null;

  const result = await generateTutorTurn({
    sessionId: "session_2",
    source: "parent-nudge",
    studentInput: "Please slow down and reinforce confidence.",
    parentGuidance: "Session direction: keep frustration low.",
    profile: {
      first_name: "Ava",
      grade: "4",
      subjects: ["Math"]
    },
    dailyContext: { daily_subjects: ["Math"] },
    sessionMemory: {
      parent_priorities: ["Session direction: keep frustration low."],
      latest_parent_guidance: "Please slow down and reinforce confidence."
    },
    recentMessages: [{ actor_type: "assistant", content: "Let us try one simple step." }],
    allowDirectAnswer: false,
    configOverride: TEST_CONFIG,
    modelCaller: async (payload) => {
      recordedCall = payload;
      return { text: "Understood. I will shift to slower confidence-building prompts." };
    }
  });

  assert.equal(typeof result.assistant_text, "string");
  assert.ok(recordedCall);
  assert.equal(
    recordedCall.userPrompt.includes("Response audience: parent only (private side-channel acknowledgement)."),
    true
  );
  assert.equal(
    recordedCall.userPrompt.includes("Parent side message: Please slow down and reinforce confidence."),
    true
  );
  assert.equal(recordedCall.userPrompt.includes("Private parent steering memory:"), true);
});
