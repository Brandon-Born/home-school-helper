import test from "node:test";
import assert from "node:assert/strict";
import TestRenderer from "react-test-renderer";

import { createUseParentGuidanceActions } from "../app/parent/hooks/useParentGuidanceActions.js";
import { createHookRenderer } from "./helpers/hook-test-renderer.js";

const { act } = TestRenderer;

test("useParentGuidanceActions sendNudge submits private note and clears input", async () => {
  const calls = {
    parentRequest: [],
    loading: [],
    errors: [],
    cleared: [],
    alerts: []
  };
  let nudgeText = "  Ask one guiding question.  ";

  const useParentGuidanceActionsHook = createUseParentGuidanceActions();
  const renderer = await createHookRenderer(() =>
    useParentGuidanceActionsHook({
      parentRequest: async (path, options = {}) => {
        calls.parentRequest.push({ path, options });
        return {
          assistant_text: "Private note sent."
        };
      },
      activeSessionId: "session_1",
      nudgeText,
      setNudgeText: (value) => {
        nudgeText = value;
      },
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
      }
    })
  );

  let prevented = false;
  await act(async () => {
    await renderer.getCurrent().sendNudge({
      preventDefault() {
        prevented = true;
      }
    });
  });

  assert.equal(prevented, true);
  assert.equal(calls.parentRequest.length, 1);
  assert.equal(calls.parentRequest[0].path, "/api/session/session_1/parent-nudge");
  assert.equal(calls.parentRequest[0].options.method, "POST");
  assert.equal(calls.parentRequest[0].options.body.nudge_text, "Ask one guiding question.");
  assert.equal(calls.parentRequest[0].options.body.parent_guidance, "Ask one guiding question.");
  assert.deepEqual(calls.loading, [
    ["nudge", true],
    ["nudge", false]
  ]);
  assert.equal(calls.errors[0], "");
  assert.deepEqual(calls.cleared, ["nudge"]);
  assert.equal(calls.alerts[0].tone, "success");
  assert.equal(calls.alerts[0].message, "Private note sent.");
  assert.equal(nudgeText, "");

  await renderer.unmount();
});
