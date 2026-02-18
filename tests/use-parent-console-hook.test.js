import test from "node:test";
import assert from "node:assert/strict";
import TestRenderer from "react-test-renderer";

import { createUseParentConsole } from "../app/parent/hooks/useParentConsole.js";
import { createHookRenderer, flushEffects } from "./helpers/hook-test-renderer.js";

const { act } = TestRenderer;

function createSessionFixture(overrides = {}) {
  return {
    session_id: "session_1",
    child_id: "child_1",
    child_name: "Ava",
    started_at: "2026-02-18T00:00:00.000Z",
    join_code: "OLDCODE1",
    expires_at: "2026-02-18T01:00:00.000Z",
    ...overrides
  };
}

test("useParentConsole merges snapshot+append stream events", async () => {
  let streamArgs = null;
  const parentRequest = async (path) => {
    if (path === "/api/parent/me") {
      return { parent: { id: "parent_1" } };
    }
    if (path === "/api/children") {
      return { children: [{ id: "child_1", first_name: "Ava" }] };
    }
    if (path === "/api/session/active") {
      return { sessions: [createSessionFixture()] };
    }
    throw new Error(`Unexpected path: ${path}`);
  };
  const parentSessionValue = {
    session: { access_token: "parent-token" },
    needsReauth: false,
    parentRequest,
    refreshParentSession: async () => null,
    invalidateParentSession: async () => {},
    signInWithGoogle: async () => {},
    signOut: async () => {}
  };

  const useParentConsoleHook = createUseParentConsole({
    useParentSessionHook: () => parentSessionValue,
    useParentTranscriptStreamHook: (args) => {
      streamArgs = args;
    }
  });

  const renderer = await createHookRenderer(() => useParentConsoleHook());
  await flushEffects();

  await act(async () => {
    streamArgs.onSnapshot([
      {
        id: "m1",
        content: "hello",
        created_at: "2026-02-18T00:00:00.000Z"
      }
    ]);
  });
  await act(async () => {
    streamArgs.onAppend([
      {
        id: "m2",
        content: "world",
        created_at: "2026-02-18T00:00:01.000Z"
      }
    ]);
  });

  const hookValue = renderer.getCurrent();
  assert.deepEqual(
    hookValue.state.messages.map((message) => message.id),
    ["m1", "m2"]
  );

  await renderer.unmount();
});

test("useParentConsole regenerateCode updates active session data and loading state", async () => {
  const parentRequest = async (path, options = {}) => {
    if (path === "/api/parent/me") {
      return { parent: { id: "parent_1" } };
    }
    if (path === "/api/children") {
      return { children: [{ id: "child_1", first_name: "Ava" }] };
    }
    if (path === "/api/session/active") {
      return { sessions: [createSessionFixture()] };
    }
    if (path === "/api/session/session_1/manage" && options.body?.action === "regenerate_code") {
      return {
        session_id: "session_1",
        join_code: "NEWCODE9",
        expires_at: "2026-02-18T02:00:00.000Z"
      };
    }
    throw new Error(`Unexpected request: ${path}`);
  };
  const parentSessionValue = {
    session: { access_token: "parent-token" },
    needsReauth: false,
    parentRequest,
    refreshParentSession: async () => null,
    invalidateParentSession: async () => {},
    signInWithGoogle: async () => {},
    signOut: async () => {}
  };

  const useParentConsoleHook = createUseParentConsole({
    useParentSessionHook: () => parentSessionValue,
    useParentTranscriptStreamHook: () => {}
  });

  const renderer = await createHookRenderer(() => useParentConsoleHook());
  await flushEffects();

  const initial = renderer.getCurrent();
  await act(async () => {
    initial.actions.rejoinSession(initial.state.activeSessions[0]);
  });

  await act(async () => {
    await renderer.getCurrent().actions.regenerateCode("session_1");
  });

  const hookValue = renderer.getCurrent();
  assert.equal(hookValue.state.loading.sessionManage, false);
  assert.equal(hookValue.state.activeSession.join_code, "NEWCODE9");
  assert.equal(hookValue.state.activeSessions[0].join_code, "NEWCODE9");
  assert.equal(hookValue.state.actionAlerts.sessionManage.tone, "success");
  assert.equal(hookValue.state.actionAlerts.sessionManage.message, "Join code refreshed.");

  await renderer.unmount();
});

test("useParentConsole exposes child mutation error feedback for inline panel messaging", async () => {
  const parentRequest = async (path, options = {}) => {
    if (path === "/api/parent/me") {
      return { parent: { id: "parent_1" } };
    }
    if (path === "/api/children" && !options.method) {
      return { children: [{ id: "child_1", first_name: "Ava" }] };
    }
    if (path === "/api/session/active") {
      return { sessions: [] };
    }
    if (path === "/api/children" && options.method === "POST") {
      throw new Error("Child save failed.");
    }
    throw new Error(`Unexpected request: ${path}`);
  };
  const parentSessionValue = {
    session: { access_token: "parent-token" },
    needsReauth: false,
    parentRequest,
    refreshParentSession: async () => null,
    invalidateParentSession: async () => {},
    signInWithGoogle: async () => {},
    signOut: async () => {}
  };

  const useParentConsoleHook = createUseParentConsole({
    useParentSessionHook: () => parentSessionValue,
    useParentTranscriptStreamHook: () => {}
  });

  const renderer = await createHookRenderer(() => useParentConsoleHook());
  await flushEffects();

  await act(async () => {
    renderer.getCurrent().actions.setChildForm((previous) => ({
      ...previous,
      child_name: "Ava",
      age: "9",
      subjects: "math"
    }));
  });

  let saved = null;
  await act(async () => {
    saved = await renderer.getCurrent().actions.createChild({
      preventDefault() {}
    });
  });

  const hookValue = renderer.getCurrent();
  assert.equal(saved, false);
  assert.equal(hookValue.state.loading.childMutation, false);
  assert.equal(hookValue.state.actionAlerts.childMutation.tone, "error");
  assert.equal(hookValue.state.actionAlerts.childMutation.message, "Child save failed.");

  await renderer.unmount();
});
