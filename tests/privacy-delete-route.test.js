import test from "node:test";
import assert from "node:assert/strict";

import { ApiError } from "../src/server/api-error.js";
import { createPrivacyDeletePostHandler } from "../app/api/privacy/delete/route.js";
import { assertApiErrorResponse, createJsonRequest } from "./helpers/route-test-helpers.js";

test("createPrivacyDeletePostHandler validates confirmation and completes deletion request", async () => {
  let recordedPolicy = null;
  let recordedDeleteParentId = null;

  const handler = createPrivacyDeletePostHandler({
    requireParentContext: async () => ({
      parent: { id: "parent_1" }
    }),
    enforceRateLimit: async (_request, policy) => {
      recordedPolicy = policy;
    },
    createPrivacyRequestForParent: async () => ({
      id: "request_1",
      request_type: "delete",
      status: "processing"
    }),
    deleteChildDataForParent: async (parentId) => {
      recordedDeleteParentId = parentId;
      return {
        deleted_children: 1,
        deleted_sessions: 2,
        deleted_messages: 12,
        requested_at: "2026-02-19T20:30:00.000Z"
      };
    },
    markPrivacyRequestCompleted: async (requestId, result) => ({
      id: requestId,
      request_type: "delete",
      status: "completed",
      result_json: result
    })
  });

  const response = await handler(
    createJsonRequest("https://example.test/api/privacy/delete", {
      reason: "Please remove all child data.",
      confirm_phrase: "DELETE CHILD DATA"
    })
  );

  assert.equal(response.status, 200);
  assert.equal(recordedPolicy.scope, "privacy_delete_request");
  assert.equal(recordedPolicy.keySuffix, "parent:parent_1");
  assert.equal(recordedDeleteParentId, "parent_1");

  const body = await response.json();
  assert.equal(body.request.status, "completed");
  assert.equal(body.deletion.deleted_messages, 12);
});

test("createPrivacyDeletePostHandler rejects invalid confirmation phrase", async () => {
  const handler = createPrivacyDeletePostHandler({
    requireParentContext: async () => ({
      parent: { id: "parent_1" }
    }),
    enforceRateLimit: async () => {}
  });

  const response = await handler(
    createJsonRequest("https://example.test/api/privacy/delete", {
      confirm_phrase: "DELETE EVERYTHING"
    })
  );

  await assertApiErrorResponse(response, {
    status: 400,
    error: "validation_error",
    message: 'confirm_phrase must exactly match "DELETE CHILD DATA".'
  });
});

test("createPrivacyDeletePostHandler marks request failed when deletion errors", async () => {
  let recordedFailedArgs = null;

  const handler = createPrivacyDeletePostHandler({
    requireParentContext: async () => ({
      parent: { id: "parent_1" }
    }),
    enforceRateLimit: async () => {},
    createPrivacyRequestForParent: async () => ({
      id: "request_1",
      request_type: "delete",
      status: "processing"
    }),
    deleteChildDataForParent: async () => {
      throw new ApiError(500, "privacy_delete_failed", "Unable to delete child data.");
    },
    markPrivacyRequestFailed: async (requestId, errorMessage) => {
      recordedFailedArgs = { requestId, errorMessage };
      return null;
    }
  });

  const response = await handler(
    createJsonRequest("https://example.test/api/privacy/delete", {
      confirm_phrase: "DELETE CHILD DATA"
    })
  );

  await assertApiErrorResponse(response, {
    status: 500,
    error: "privacy_delete_failed",
    message: "Unable to delete child data."
  });

  assert.deepEqual(recordedFailedArgs, {
    requestId: "request_1",
    errorMessage: "Unable to delete child data."
  });
});
