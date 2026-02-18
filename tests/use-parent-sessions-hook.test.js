import test from "node:test";
import assert from "node:assert/strict";
import { act } from "react";

import { createUseParentSessions } from "../app/parent/hooks/useParentSessions.js";
import { createHookRenderer } from "./helpers/hook-test-renderer.js";

test("useParentSessions regenerateCode refreshes active and listed session metadata", async () => {
  const calls = {
    loading: [],
    errors: [],
    cleared: [],
    alerts: []
  };
  let activeSession = {
    session_id: "session_1",
    child_id: "child_1",
    child_name: "Ava",
    join_code: "OLD12345",
    expires_at: "2026-02-18T01:00:00.000Z"
  };
  let activeSessions = [
    {
      session_id: "session_1",
      child_id: "child_1",
      child_name: "Ava",
      join_code: "OLD12345",
      expires_at: "2026-02-18T01:00:00.000Z"
    }
  ];

  const useParentSessionsHook = createUseParentSessions();
  const renderer = await createHookRenderer(() =>
    useParentSessionsHook({
      parentRequest: async (path, options = {}) => {
        assert.equal(path, "/api/session/session_1/manage");
        assert.equal(options.body?.action, "regenerate_code");
        return {
          session_id: "session_1",
          join_code: "NEW12345",
          expires_at: "2026-02-18T03:00:00.000Z"
        };
      },
      children: [{ id: "child_1", first_name: "Ava" }],
      selectedChildId: "child_1",
      sessionForm: {
        daily_subjects: "Math",
        parent_context: "",
        goal_notes: "",
        additional_context: ""
      },
      activeSessionId: "session_1",
      setLoadingState: (key, value) => {
        calls.loading.push([key, value]);
      },
      setError: (value) => {
        calls.errors.push(value);
      },
      clearActionAlert: (key) => {
        calls.cleared.push(key);
      },
      setActionAlert: (key, tone, message) => {
        calls.alerts.push({ key, tone, message });
      },
      setActiveSession: (next) => {
        activeSession = typeof next === "function" ? next(activeSession) : next;
      },
      setActiveSessions: (next) => {
        activeSessions = typeof next === "function" ? next(activeSessions) : next;
      },
      setSelectedChildId: () => {},
      setMessages: () => {}
    })
  );

  let result = null;
  await act(async () => {
    result = await renderer.getCurrent().regenerateCode("session_1");
  });

  assert.equal(result?.join_code, "NEW12345");
  assert.equal(activeSession.join_code, "NEW12345");
  assert.equal(activeSession.expires_at, "2026-02-18T03:00:00.000Z");
  assert.equal(activeSessions[0].join_code, "NEW12345");
  assert.equal(activeSessions[0].expires_at, "2026-02-18T03:00:00.000Z");
  assert.deepEqual(calls.loading, [
    ["sessionManage", true],
    ["sessionManage", false]
  ]);
  assert.equal(calls.errors[0], "");
  assert.deepEqual(calls.cleared, ["sessionManage"]);
  assert.equal(calls.alerts[0].tone, "success");
  assert.equal(calls.alerts[0].message, "Join code refreshed.");

  await renderer.unmount();
});
