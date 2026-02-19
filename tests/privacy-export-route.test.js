import test from "node:test";
import assert from "node:assert/strict";

import { ApiError } from "../src/server/api-error.js";
import { createPrivacyExportPostHandler } from "../app/api/privacy/export/route.js";
import { assertApiErrorResponse, createJsonRequest } from "./helpers/route-test-helpers.js";

test("createPrivacyExportPostHandler creates request, generates snapshot, and marks completion", async () => {
  let recordedPolicy = null;
  let recordedCreateRequest = null;
  let recordedCompleteArgs = null;

  const handler = createPrivacyExportPostHandler({
    requireParentContext: async () => ({
      parent: { id: "parent_1" }
    }),
    enforceRateLimit: async (_request, policy) => {
      recordedPolicy = policy;
    },
    createPrivacyRequestForParent: async (parentId, payload) => {
      recordedCreateRequest = { parentId, payload };
      return {
        id: "request_1",
        request_type: "export",
        status: "processing",
        requested_at: "2026-02-19T20:10:00.000Z"
      };
    },
    generateExportSnapshotForParent: async () => ({
      generated_at: "2026-02-19T20:11:00.000Z",
      summary: { counts: { children: 1, sessions: 2 } },
      data: { children: [], sessions: [], messages: [] }
    }),
    markPrivacyRequestCompleted: async (requestId, result) => {
      recordedCompleteArgs = { requestId, result };
      return {
        id: requestId,
        request_type: "export",
        status: "completed",
        result_json: result
      };
    }
  });

  const response = await handler(
    createJsonRequest(
      "https://example.test/api/privacy/export",
      { reason: "Need a copy for records." },
      {
        headers: {
          "x-forwarded-for": "198.51.100.10",
          "user-agent": "unit-test-agent"
        }
      }
    )
  );

  assert.equal(response.status, 200);
  assert.equal(recordedPolicy.scope, "privacy_export_request");
  assert.equal(recordedPolicy.keySuffix, "parent:parent_1");
  assert.equal(recordedCreateRequest.parentId, "parent_1");
  assert.equal(recordedCreateRequest.payload.request_type, "export");
  assert.equal(recordedCompleteArgs.requestId, "request_1");
  assert.equal(recordedCompleteArgs.result.counts.children, 1);

  const body = await response.json();
  assert.equal(body.request.status, "completed");
  assert.equal(body.export_snapshot.summary.counts.sessions, 2);
});

test("createPrivacyExportPostHandler marks request failed when export generation errors", async () => {
  let recordedFailedArgs = null;

  const handler = createPrivacyExportPostHandler({
    requireParentContext: async () => ({
      parent: { id: "parent_1" }
    }),
    enforceRateLimit: async () => {},
    createPrivacyRequestForParent: async () => ({
      id: "request_1",
      request_type: "export",
      status: "processing"
    }),
    generateExportSnapshotForParent: async () => {
      throw new ApiError(500, "privacy_export_messages_failed", "Unable to build transcript export.");
    },
    markPrivacyRequestFailed: async (requestId, errorMessage) => {
      recordedFailedArgs = { requestId, errorMessage };
      return null;
    }
  });

  const response = await handler(
    createJsonRequest("https://example.test/api/privacy/export", { reason: "Need a copy for records." })
  );

  await assertApiErrorResponse(response, {
    status: 500,
    error: "privacy_export_messages_failed",
    message: "Unable to build transcript export."
  });

  assert.deepEqual(recordedFailedArgs, {
    requestId: "request_1",
    errorMessage: "Unable to build transcript export."
  });
});
