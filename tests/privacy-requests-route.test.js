import test from "node:test";
import assert from "node:assert/strict";

import { ApiError } from "../src/server/api-error.js";
import { createPrivacyRequestsGetHandler } from "../app/api/privacy/requests/route.js";
import { assertApiErrorResponse } from "./helpers/route-test-helpers.js";

test("createPrivacyRequestsGetHandler returns parent-scoped privacy requests", async () => {
  let recordedParentId = null;
  let recordedPolicy = null;

  const handler = createPrivacyRequestsGetHandler({
    requireParentContext: async () => ({
      parent: { id: "parent_1" }
    }),
    enforceRateLimit: async (_request, policy) => {
      recordedPolicy = policy;
    },
    listPrivacyRequestsForParent: async (parentId) => {
      recordedParentId = parentId;
      return [{ id: "request_1", request_type: "export", status: "completed" }];
    }
  });

  const response = await handler(new Request("https://example.test/api/privacy/requests", { method: "GET" }));
  assert.equal(response.status, 200);
  assert.equal(recordedParentId, "parent_1");
  assert.equal(recordedPolicy.scope, "privacy_requests_list");
  assert.equal(recordedPolicy.keySuffix, "parent:parent_1");

  const body = await response.json();
  assert.equal(body.requests.length, 1);
  assert.equal(body.requests[0].id, "request_1");
});

test("createPrivacyRequestsGetHandler returns rate_limited when limiter rejects", async () => {
  const handler = createPrivacyRequestsGetHandler({
    requireParentContext: async () => ({
      parent: { id: "parent_1" }
    }),
    enforceRateLimit: async () => {
      throw new ApiError(429, "rate_limited", "Too many requests. Please try again shortly.");
    }
  });

  const response = await handler(new Request("https://example.test/api/privacy/requests", { method: "GET" }));

  await assertApiErrorResponse(response, {
    status: 429,
    error: "rate_limited",
    message: "Too many requests. Please try again shortly."
  });
});
