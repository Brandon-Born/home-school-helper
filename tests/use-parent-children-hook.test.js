import test from "node:test";
import assert from "node:assert/strict";
import TestRenderer from "react-test-renderer";

import { createUseParentChildren } from "../app/parent/hooks/useParentChildren.js";
import { createHookRenderer } from "./helpers/hook-test-renderer.js";

const { act } = TestRenderer;

test("useParentChildren createChild normalizes payload and emits success feedback", async () => {
  const calls = {
    parentRequest: [],
    loading: [],
    errors: [],
    cleared: [],
    alerts: [],
    childForm: []
  };
  let refreshed = 0;
  let prevented = false;

  const useParentChildrenHook = createUseParentChildren();
  const renderer = await createHookRenderer(() =>
    useParentChildrenHook({
      parentRequest: async (path, options = {}) => {
        calls.parentRequest.push({ path, options });
        return { child: { id: "child_2" } };
      },
      childForm: {
        child_name: "Ava",
        age: "9",
        grade: "4",
        subjects: "Math, Reading",
        personality_description: "Curious",
        special_needs: ""
      },
      selectedChildId: "child_1",
      fetchParentData: async () => {
        refreshed += 1;
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
      },
      setChildForm: (value) => {
        calls.childForm.push(value);
      },
      setSelectedChildId: () => {}
    })
  );

  let saved = null;
  await act(async () => {
    saved = await renderer.getCurrent().createChild({
      preventDefault() {
        prevented = true;
      }
    });
  });

  assert.equal(saved, true);
  assert.equal(prevented, true);
  assert.equal(refreshed, 1);
  assert.equal(calls.parentRequest.length, 1);
  assert.equal(calls.parentRequest[0].path, "/api/children");
  assert.equal(calls.parentRequest[0].options.method, "POST");
  assert.deepEqual(calls.parentRequest[0].options.body.subjects, ["Math", "Reading"]);
  assert.equal(calls.parentRequest[0].options.body.age, 9);
  assert.deepEqual(calls.loading, [
    ["childMutation", true],
    ["childMutation", false]
  ]);
  assert.deepEqual(calls.cleared, ["childMutation"]);
  assert.equal(calls.errors[0], "");
  assert.equal(calls.alerts[0].key, "childMutation");
  assert.equal(calls.alerts[0].tone, "success");
  assert.equal(calls.alerts[0].message, "Child profile saved.");
  assert.equal(calls.childForm.length, 1);
  assert.equal(calls.childForm[0].child_name, "");

  await renderer.unmount();
});
