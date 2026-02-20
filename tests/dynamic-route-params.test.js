import test from "node:test";
import assert from "node:assert/strict";

import { createMessagesGetHandler } from "../app/api/session/[id]/messages/route.js";
import { createStreamGetHandler } from "../app/api/session/[id]/stream/route.js";
import { createSpeechSynthesizePostHandler } from "../app/api/session/[id]/speech/synthesize/route.js";
import { createSpeechTranscribePostHandler } from "../app/api/session/[id]/speech/transcribe/route.js";
import { createChildTurnPostHandler } from "../app/api/session/[id]/child-turn/route.js";
import { createParentNudgePostHandler } from "../app/api/session/[id]/parent-nudge/route.js";
import { createOverridePostHandler } from "../app/api/session/[id]/override/route.js";
import { assertApiErrorResponse, createAudioFormRequest, createJsonRequest } from "./helpers/route-test-helpers.js";

const originalSpeechTelemetrySetting = process.env.SPEECH_TELEMETRY_DISABLED;
process.env.SPEECH_TELEMETRY_DISABLED = "1";
test.after(() => {
  process.env.SPEECH_TELEMETRY_DISABLED = originalSpeechTelemetrySetting;
});

test("dynamic route handlers accept promised params for messages and stream routes", async () => {
  const messagesHandler = createMessagesGetHandler({
    resolveSessionViewerContext: async (_request, sessionId) => ({ visibility: sessionId }),
    listSessionMessages: async ({ sessionId }) => [{ id: sessionId }]
  });

  const messagesResponse = await messagesHandler(
    new Request("https://example.test/api/session/s1/messages?limit=10"),
    { params: Promise.resolve({ id: "s1" }) }
  );
  assert.equal(messagesResponse.status, 200);
  const messagesPayload = await messagesResponse.json();
  assert.deepEqual(messagesPayload.messages, [{ id: "s1" }]);
  assert.equal(messagesPayload.visibility, "s1");

  const streamHandler = createStreamGetHandler({
    resolveSessionViewerContext: async (_request, sessionId) => ({ role: "parent", visibility: sessionId }),
    listSessionMessages: async () => [],
    createSessionMessageSubscription: async () => async () => {},
    setTimer: () => ({ timer: true }),
    clearTimer: () => {},
    logStreamEvent: () => {}
  });

  const streamResponse = await streamHandler(new Request("https://example.test/api/session/s2/stream"), {
    params: Promise.resolve({ id: "s2" })
  });
  assert.equal(streamResponse.status, 200);
  assert.equal(streamResponse.headers.get("content-type"), "text/event-stream; charset=utf-8");
});

test("speech routes accept promised params", async () => {
  const recorded = {
    transcribeSessionId: null,
    synthSessionId: null,
    transcribeOptions: null,
    synthOptions: null
  };

  const transcribeHandler = createSpeechTranscribePostHandler({
    enforceRateLimit: () => {},
    requireChildSessionContext: async (_request, sessionId, options) => {
      recorded.transcribeSessionId = sessionId;
      recorded.transcribeOptions = options;
      return { tokenRow: { child_id: "child_1" } };
    },
    transcribeSpeech: async () => ({ transcript: "hello" })
  });

  const transcribeResponse = await transcribeHandler(
    createAudioFormRequest("https://example.test/api/session/s3/speech/transcribe"),
    { params: Promise.resolve({ id: "s3" }) }
  );
  assert.equal(transcribeResponse.status, 200);
  assert.equal(recorded.transcribeSessionId, "s3");
  assert.equal(recorded.transcribeOptions?.requireActiveSession, true);

  const synthHandler = createSpeechSynthesizePostHandler({
    enforceRateLimit: () => {},
    requireChildSessionContext: async (_request, sessionId, options) => {
      recorded.synthSessionId = sessionId;
      recorded.synthOptions = options;
      return { tokenRow: { child_id: "child_1" } };
    },
    synthesizeSpeech: async () => new Uint8Array([1, 2, 3])
  });

  const synthResponse = await synthHandler(
    createJsonRequest("https://example.test/api/session/s4/speech/synthesize", { text: "hello" }),
    { params: Promise.resolve({ id: "s4" }) }
  );
  assert.equal(synthResponse.status, 200);
  assert.equal(recorded.synthSessionId, "s4");
  assert.equal(recorded.synthOptions?.requireActiveSession, true);
});

test("child-turn route accepts promised params", async () => {
  const recorded = {
    childSessionId: null,
    tutorContextArgs: null,
    runTurnArgs: null
  };

  const handler = createChildTurnPostHandler({
    enforceRateLimit: () => {},
    requireChildSessionContext: async (_request, sessionId) => {
      recorded.childSessionId = sessionId;
      return {
        tokenRow: {
          child_id: "child_1"
        }
      };
    },
    getSessionTutorContext: async (args) => {
      recorded.tutorContextArgs = args;
      return {
        latestParentGuidance: "guide",
        profile: {},
        dailyContext: {},
        allowDirectAnswer: false
      };
    },
    runSessionTutorTurn: async (args) => {
      recorded.runTurnArgs = args;
      return {
        assistant_text: "ok"
      };
    }
  });

  const response = await handler(
    createJsonRequest("https://example.test/api/session/s5/child-turn", { student_input: "help" }),
    { params: Promise.resolve({ id: "s5" }) }
  );

  assert.equal(response.status, 200);
  assert.equal(recorded.childSessionId, "s5");
  assert.deepEqual(recorded.tutorContextArgs, {
    sessionId: "s5",
    childId: "child_1"
  });
  assert.equal(recorded.runTurnArgs.sessionId, "s5");
});

test("child-turn route rejects oversized student input", async () => {
  const handler = createChildTurnPostHandler({
    enforceRateLimit: () => {},
    requireChildSessionContext: async () => ({
      tokenRow: {
        child_id: "child_1"
      }
    }),
    getSessionTutorContext: async () => ({
      latestParentGuidance: null,
      profile: {},
      dailyContext: {},
      allowDirectAnswer: false
    }),
    runSessionTutorTurn: async () => ({
      assistant_text: "ok"
    })
  });

  const response = await handler(
    createJsonRequest("https://example.test/api/session/s5/child-turn", { student_input: "a".repeat(4001) }),
    { params: Promise.resolve({ id: "s5" }) }
  );

  await assertApiErrorResponse(response, {
    status: 413,
    error: "payload_too_large",
    message: "student_input must be at most 4000 characters."
  });
});

test("parent-nudge and override routes accept promised params", async () => {
  const recorded = {
    nudgeOwnsArgs: null,
    nudgeContextArgs: null,
    nudgeTurnArgs: null,
    overrideArgs: null
  };

  const nudgeHandler = createParentNudgePostHandler({
    enforceRateLimit: () => {},
    requireParentContext: async () => ({
      parent: {
        id: "parent_1"
      }
    }),
    ensureParentOwnsSession: async (parentId, sessionId) => {
      recorded.nudgeOwnsArgs = { parentId, sessionId };
    },
    getSessionTutorContext: async (args) => {
      recorded.nudgeContextArgs = args;
      return {
        profile: {},
        dailyContext: {},
        allowDirectAnswer: false
      };
    },
    runSessionTutorTurn: async (args) => {
      recorded.nudgeTurnArgs = args;
      return {
        assistant_text: "queued"
      };
    }
  });

  const nudgeResponse = await nudgeHandler(
    createJsonRequest("https://example.test/api/session/s6/parent-nudge", {
      nudge_text: "slow down"
    }),
    { params: Promise.resolve({ id: "s6" }) }
  );
  assert.equal(nudgeResponse.status, 200);
  assert.deepEqual(recorded.nudgeOwnsArgs, {
    parentId: "parent_1",
    sessionId: "s6"
  });
  assert.deepEqual(recorded.nudgeContextArgs, {
    sessionId: "s6",
    parentId: "parent_1"
  });
  assert.equal(recorded.nudgeTurnArgs.sessionId, "s6");
  assert.equal(recorded.nudgeTurnArgs.assistantVisibilityScope, "parent_only");

  const overrideHandler = createOverridePostHandler({
    requireParentContext: async () => ({
      parent: {
        id: "parent_1"
      }
    }),
    setSessionDirectAnswerOverride: async (args) => {
      recorded.overrideArgs = args;
      return {
        session_id: args.sessionId,
        direct_answer_enabled: args.enabled,
        expires_at: "2026-02-18T00:00:00.000Z"
      };
    }
  });

  const overrideResponse = await overrideHandler(
    createJsonRequest("https://example.test/api/session/s7/override", {
      enabled: true,
      duration_minutes: 15
    }),
    { params: Promise.resolve({ id: "s7" }) }
  );
  assert.equal(overrideResponse.status, 200);
  assert.deepEqual(recorded.overrideArgs, {
    sessionId: "s7",
    parentId: "parent_1",
    enabled: true,
    durationMinutes: 15
  });
});

test("parent-nudge route rejects oversized nudge text", async () => {
  const handler = createParentNudgePostHandler({
    enforceRateLimit: () => {},
    requireParentContext: async () => ({
      parent: {
        id: "parent_1"
      }
    }),
    ensureParentOwnsSession: async () => {},
    getSessionTutorContext: async () => ({
      profile: {},
      dailyContext: {},
      allowDirectAnswer: false
    }),
    runSessionTutorTurn: async () => ({
      assistant_text: "queued"
    })
  });

  const response = await handler(
    createJsonRequest("https://example.test/api/session/s6/parent-nudge", {
      nudge_text: "a".repeat(2001)
    }),
    { params: Promise.resolve({ id: "s6" }) }
  );

  await assertApiErrorResponse(response, {
    status: 413,
    error: "payload_too_large",
    message: "nudge_text must be at most 2000 characters."
  });
});
