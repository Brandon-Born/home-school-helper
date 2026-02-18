import test from "node:test";
import assert from "node:assert/strict";

import { ApiError } from "../src/server/api-error.js";
import { createSessionActiveGetHandler } from "../app/api/session/active/route.js";
import { createSessionManagePostHandler } from "../app/api/session/[id]/manage/route.js";
import { assertApiErrorResponse, createJsonRequest } from "./helpers/route-test-helpers.js";

test("createSessionActiveGetHandler returns rate_limited when limiter rejects", async () => {
  const handler = createSessionActiveGetHandler({
    requireParentContext: async () => ({
      parent: {
        id: "parent_1"
      }
    }),
    enforceRateLimit: () => {
      throw new ApiError(429, "rate_limited", "Too many requests. Please try again shortly.");
    }
  });

  const response = await handler(new Request("https://example.test/api/session/active", { method: "GET" }));

  await assertApiErrorResponse(response, {
    status: 429,
    error: "rate_limited",
    message: "Too many requests. Please try again shortly."
  });
});

test("createSessionActiveGetHandler returns sessions and uses parent-scoped limiter key", async () => {
  let recordedParentId = null;
  let recordedPolicy = null;

  const handler = createSessionActiveGetHandler({
    requireParentContext: async () => ({
      parent: {
        id: "parent_1"
      }
    }),
    enforceRateLimit: (_request, policy) => {
      recordedPolicy = policy;
    },
    listActiveSessionsForParent: async (parentId) => {
      recordedParentId = parentId;
      return [{ session_id: "session_1" }];
    }
  });

  const response = await handler(new Request("https://example.test/api/session/active", { method: "GET" }));
  assert.equal(response.status, 200);
  assert.equal(recordedParentId, "parent_1");
  assert.equal(recordedPolicy.scope, "session_active_list");
  assert.equal(recordedPolicy.keySuffix, "parent:parent_1");

  const body = await response.json();
  assert.deepEqual(body, {
    sessions: [{ session_id: "session_1" }]
  });
});

test("createSessionManagePostHandler returns rate_limited when limiter rejects", async () => {
  const handler = createSessionManagePostHandler({
    requireParentContext: async () => ({
      parent: {
        id: "parent_1"
      }
    }),
    enforceRateLimit: () => {
      throw new ApiError(429, "rate_limited", "Too many requests. Please try again shortly.");
    }
  });

  const response = await handler(
    createJsonRequest("https://example.test/api/session/session_1/manage", { action: "end" }),
    { params: Promise.resolve({ id: "session_1" }) }
  );

  await assertApiErrorResponse(response, {
    status: 429,
    error: "rate_limited",
    message: "Too many requests. Please try again shortly."
  });
});

test("createSessionManagePostHandler ends a session with parent+session scoped limiter key", async () => {
  let recordedArgs = null;
  let recordedPolicy = null;

  const handler = createSessionManagePostHandler({
    requireParentContext: async () => ({
      parent: {
        id: "parent_1"
      }
    }),
    enforceRateLimit: (_request, policy) => {
      recordedPolicy = policy;
    },
    endSessionForParent: async (parentId, sessionId) => {
      recordedArgs = { parentId, sessionId };
      return { id: sessionId, status: "ended" };
    }
  });

  const response = await handler(
    createJsonRequest("https://example.test/api/session/session_1/manage", { action: "end" }),
    { params: Promise.resolve({ id: "session_1" }) }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(recordedArgs, {
    parentId: "parent_1",
    sessionId: "session_1"
  });
  assert.equal(recordedPolicy.scope, "session_manage");
  assert.equal(recordedPolicy.keySuffix, "parent:parent_1:session:session_1");

  const body = await response.json();
  assert.deepEqual(body, {
    session: { id: "session_1", status: "ended" }
  });
});

test("createSessionManagePostHandler regenerates code when action is regenerate_code", async () => {
  let recordedArgs = null;

  const handler = createSessionManagePostHandler({
    requireParentContext: async () => ({
      parent: {
        id: "parent_1"
      }
    }),
    enforceRateLimit: () => {},
    regenerateJoinCodeForSession: async (parentId, sessionId) => {
      recordedArgs = { parentId, sessionId };
      return {
        session_id: sessionId,
        join_code: "AB12CD34",
        expires_at: "2026-02-18T00:00:00.000Z"
      };
    }
  });

  const response = await handler(
    createJsonRequest("https://example.test/api/session/session_2/manage", { action: "regenerate_code" }),
    { params: Promise.resolve({ id: "session_2" }) }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(recordedArgs, {
    parentId: "parent_1",
    sessionId: "session_2"
  });

  const body = await response.json();
  assert.deepEqual(body, {
    session_id: "session_2",
    join_code: "AB12CD34",
    expires_at: "2026-02-18T00:00:00.000Z"
  });
});
