import test from "node:test";
import assert from "node:assert/strict";

import {
  persistPolicyEvent,
  persistTutorAuditEvents
} from "../src/server/session-foundation/policy-event-service.js";
import { ApiError } from "../src/server/api-error.js";

function createPolicyEventServiceClient({ fail = false } = {}) {
  const rows = [];

  return {
    rows,
    from(tableName) {
      assert.equal(tableName, "policy_events");
      return {
        async insert(payload) {
          if (fail) {
            return {
              error: {
                message: "insert failed"
              }
            };
          }

          rows.push(...(Array.isArray(payload) ? payload : [payload]));
          return { error: null };
        }
      };
    }
  };
}

test("persistPolicyEvent writes a single policy event row", async () => {
  const serviceClient = createPolicyEventServiceClient();
  await persistPolicyEvent(
    {
      sessionId: "session_1",
      eventType: "guardrail_policy",
      actionTaken: "scaffold_rewrite",
      metadata: { route: "child-turn" }
    },
    { serviceClient }
  );

  assert.equal(serviceClient.rows.length, 1);
  assert.deepEqual(serviceClient.rows[0], {
    session_id: "session_1",
    event_type: "guardrail_policy",
    action_taken: "scaffold_rewrite",
    metadata: { route: "child-turn" }
  });
});

test("persistTutorAuditEvents writes model and policy rows", async () => {
  const serviceClient = createPolicyEventServiceClient();
  await persistTutorAuditEvents(
    {
      sessionId: "session_2",
      source: "parent-nudge",
      modelUsed: "claude-test",
      promptVersion: "v1",
      policyApplied: ["none", "scaffold_rewrite"]
    },
    { serviceClient }
  );

  assert.equal(serviceClient.rows.length, 3);
  assert.deepEqual(serviceClient.rows[0], {
    session_id: "session_2",
    event_type: "tutor_model_call",
    action_taken: "model_response_generated",
    metadata: {
      route: "parent-nudge",
      model_used: "claude-test",
      prompt_version: "v1"
    }
  });
  assert.equal(serviceClient.rows[1].action_taken, "none");
  assert.equal(serviceClient.rows[2].action_taken, "scaffold_rewrite");
});

test("persistTutorAuditEvents surfaces persistence failures", async () => {
  const serviceClient = createPolicyEventServiceClient({ fail: true });

  await assert.rejects(
    () =>
      persistTutorAuditEvents(
        {
          sessionId: "session_3",
          source: "child-turn",
          modelUsed: "claude-test",
          promptVersion: "v1",
          policyApplied: ["none"]
        },
        { serviceClient }
      ),
    (error) =>
      error instanceof ApiError &&
      error.status === 500 &&
      error.code === "policy_event_persist_failed"
  );
});
