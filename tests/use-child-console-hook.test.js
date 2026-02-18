import test from "node:test";
import assert from "node:assert/strict";
import TestRenderer from "react-test-renderer";

import { createUseChildConsole } from "../app/child/hooks/useChildConsole.js";
import { createHookRenderer, flushEffects } from "./helpers/hook-test-renderer.js";

const { act } = TestRenderer;

function createLocalStorageMock() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    }
  };
}

function buildVoiceStub() {
  const pendingCalls = [];
  return {
    state: {
      voiceBusy: false,
      isTranscribing: false,
      isPlayingSpeech: false,
      pendingTutorReply: false,
      turnStatus: "idle",
      speechSupport: "available",
      isListening: false,
      isCloudRecording: false,
      autoSpeak: true,
      voiceStatus: "ready",
      listeningLabel: "Idle"
    },
    stream: {
      initializeFromSnapshot: () => {},
      handleIncomingMessages: () => {}
    },
    actions: {
      setAutoSpeak: () => {},
      startVoiceCapture: () => {},
      stopVoiceCapture: () => {},
      resetVoiceRuntime: () => {},
      setPendingTutorReply: (value) => {
        pendingCalls.push(value);
      }
    },
    pendingCalls
  };
}

test("useChildConsole handles join/send optimistic updates and stream auth invalidation", async () => {
  const localStorage = createLocalStorageMock();
  global.window = { localStorage };

  let streamArgs = null;
  const voice = buildVoiceStub();
  const useChildConsoleHook = createUseChildConsole({
    apiRequestImpl: async (path, options = {}) => {
      if (path === "/api/session/join") {
        return {
          session_access: {
            session_id: "session_1",
            child_session_token: "child-token",
            child_id: "child_1"
          }
        };
      }

      if (path === "/api/session/session_1/child-turn") {
        return {
          input_message: {
            id: "m1",
            actor_type: "child",
            created_at: "2026-02-18T00:00:00.000Z"
          },
          assistant_message: {
            id: "m2",
            actor_type: "assistant",
            created_at: "2026-02-18T00:00:01.000Z"
          }
        };
      }

      throw new Error(`Unexpected request: ${path} ${JSON.stringify(options)}`);
    },
    useSessionStreamHook: (args) => {
      streamArgs = args;
    },
    useChildVoiceRuntimeHook: () => voice
  });

  const renderer = await createHookRenderer(() => useChildConsoleHook());
  await flushEffects();

  await act(async () => {
    renderer.getCurrent().actions.setJoinCode("AB12CD34");
  });
  await act(async () => {
    await renderer.getCurrent().actions.joinSession({
      preventDefault() {}
    });
  });

  const afterJoin = renderer.getCurrent();
  assert.equal(afterJoin.state.loading.join, false);
  assert.equal(afterJoin.state.sessionAccess.session_id, "session_1");

  await act(async () => {
    renderer.getCurrent().actions.setStudentInput("Help please");
  });
  await act(async () => {
    await renderer.getCurrent().actions.sendTurn({
      preventDefault() {}
    });
  });

  const afterSend = renderer.getCurrent();
  assert.equal(afterSend.state.loading.send, false);
  assert.deepEqual(
    afterSend.state.messages.map((message) => message.id),
    ["m1", "m2"]
  );
  assert.equal(afterSend.state.studentInput, "");
  assert.deepEqual(voice.pendingCalls, [false, true, false]);

  let disconnectOutcome = null;
  await act(async () => {
    disconnectOutcome = streamArgs.onDisconnect(new Error("token expired"));
  });
  assert.equal(disconnectOutcome, "stop");
  assert.equal(renderer.getCurrent().state.sessionAccess, null);
  assert.equal(renderer.getCurrent().state.error, "Your lesson code expired. Please ask your parent for a new code.");

  await renderer.unmount();
  delete global.window;
});
