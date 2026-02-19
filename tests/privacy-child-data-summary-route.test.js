import test from "node:test";
import assert from "node:assert/strict";

import { ApiError } from "../src/server/api-error.js";
import { createPrivacyChildDataSummaryGetHandler } from "../app/api/privacy/child-data-summary/route.js";
import { assertApiErrorResponse } from "./helpers/route-test-helpers.js";

test("createPrivacyChildDataSummaryGetHandler returns summary for authenticated parent", async () => {
  let recordedParentId = null;
  let recordedPolicy = null;

  const handler = createPrivacyChildDataSummaryGetHandler({
    requireParentContext: async () => ({
      parent: { id: "parent_1" }
    }),
    enforceRateLimit: async (_request, policy) => {
      recordedPolicy = policy;
    },
    getChildDataSummaryForParent: async (parentId) => {
      recordedParentId = parentId;
      return {
        generated_at: "2026-02-19T00:00:00.000Z",
        counts: {
          children: 1,
          sessions: 2
        }
      };
    }
  });

  const response = await handler(new Request("https://example.test/api/privacy/child-data-summary", { method: "GET" }));
  assert.equal(response.status, 200);
  assert.equal(recordedParentId, "parent_1");
  assert.equal(recordedPolicy.scope, "privacy_child_data_summary");
  assert.equal(recordedPolicy.keySuffix, "parent:parent_1");

  const body = await response.json();
  assert.equal(body.summary.counts.children, 1);
});

test("createPrivacyChildDataSummaryGetHandler returns rate_limited when limiter rejects", async () => {
  const handler = createPrivacyChildDataSummaryGetHandler({
    requireParentContext: async () => ({
      parent: { id: "parent_1" }
    }),
    enforceRateLimit: async () => {
      throw new ApiError(429, "rate_limited", "Too many requests. Please try again shortly.");
    }
  });

  const response = await handler(new Request("https://example.test/api/privacy/child-data-summary", { method: "GET" }));

  await assertApiErrorResponse(response, {
    status: 429,
    error: "rate_limited",
    message: "Too many requests. Please try again shortly."
  });
});
