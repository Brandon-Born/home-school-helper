import test from "node:test";
import assert from "node:assert/strict";

import { runAsyncActionStatus } from "../app/parent/hooks/parent-action-status.js";

test("runAsyncActionStatus applies pending and success lifecycle state", async () => {
  const calls = {
    loading: [],
    errors: [],
    cleared: [],
    alerts: [],
    success: []
  };

  const outcome = await runAsyncActionStatus({
    actionKey: "sessionStart",
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
    run: async () => ({ session_id: "session_1" }),
    onSuccess: (result) => {
      calls.success.push(result.session_id);
      return "Join code is ready to share.";
    }
  });

  assert.equal(outcome.ok, true);
  assert.equal(outcome.result.session_id, "session_1");
  assert.equal(outcome.error, null);
  assert.deepEqual(calls.loading, [
    ["sessionStart", true],
    ["sessionStart", false]
  ]);
  assert.deepEqual(calls.errors, [""]);
  assert.deepEqual(calls.cleared, ["sessionStart"]);
  assert.deepEqual(calls.success, ["session_1"]);
  assert.deepEqual(calls.alerts, [
    {
      key: "sessionStart",
      tone: "success",
      message: "Join code is ready to share."
    }
  ]);
});

test("runAsyncActionStatus applies error lifecycle state and fallback message", async () => {
  const calls = {
    loading: [],
    alerts: [],
    onError: []
  };

  const outcome = await runAsyncActionStatus({
    actionKey: "nudge",
    setLoadingState: (key, value) => {
      calls.loading.push([key, value]);
    },
    setError: () => {},
    clearActionAlert: () => {},
    setActionAlert: (key, tone, message) => {
      calls.alerts.push({ key, tone, message });
    },
    fallbackErrorMessage: "Fallback nudge error.",
    run: async () => {
      throw "raw_error";
    },
    onError: (error) => {
      calls.onError.push(error);
    }
  });

  assert.equal(outcome.ok, false);
  assert.equal(outcome.result, null);
  assert.equal(outcome.error, "raw_error");
  assert.deepEqual(calls.loading, [
    ["nudge", true],
    ["nudge", false]
  ]);
  assert.deepEqual(calls.onError, ["raw_error"]);
  assert.deepEqual(calls.alerts, [
    {
      key: "nudge",
      tone: "error",
      message: "Fallback nudge error."
    }
  ]);
});
