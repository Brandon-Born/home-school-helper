import test from "node:test";
import assert from "node:assert/strict";

import { ApiError } from "../src/server/api-error.js";
import { createSessionJoinPostHandler } from "../app/api/session/join/route.js";
import { createSessionStartPostHandler } from "../app/api/session/start/route.js";
import {
  assertApiErrorResponse,
  createJsonRequest
} from "./helpers/route-test-helpers.js";

test("createSessionJoinPostHandler returns rate_limited error when limiter rejects", async () => {
  const handler = createSessionJoinPostHandler({
    enforceRateLimit: () => {
      throw new ApiError(429, "rate_limited", "Too many requests. Please try again shortly.");
    }
  });

  const response = await handler(createJsonRequest("https://example.test/api/session/join", { code: "AB12CD34" }));

  await assertApiErrorResponse(response, {
    status: 429,
    error: "rate_limited",
    message: "Too many requests. Please try again shortly."
  });
});

test("createSessionStartPostHandler returns rate_limited error when limiter rejects", async () => {
  const handler = createSessionStartPostHandler({
    enforceRateLimit: () => {
      throw new ApiError(429, "rate_limited", "Too many requests. Please try again shortly.");
    }
  });

  const response = await handler(
    createJsonRequest("https://example.test/api/session/start", { child_id: "child_1", daily_subjects: ["Math"] })
  );

  await assertApiErrorResponse(response, {
    status: 429,
    error: "rate_limited",
    message: "Too many requests. Please try again shortly."
  });
});

test("createSessionStartPostHandler starts session when auth and payload are valid", async () => {
  let recordedParentId = null;
  let recordedPayload = null;

  const handler = createSessionStartPostHandler({
    enforceRateLimit: () => {},
    requireParentContext: async () => ({
      parent: {
        id: "parent_1"
      }
    }),
    startSessionForParent: async (parentId, payload) => {
      recordedParentId = parentId;
      recordedPayload = payload;
      return {
        session_id: "session_1",
        child_id: "child_1"
      };
    }
  });

  const inputPayload = { child_id: "child_1", daily_subjects: ["Math"] };
  const response = await handler(createJsonRequest("https://example.test/api/session/start", inputPayload));

  assert.equal(response.status, 201);
  assert.equal(recordedParentId, "parent_1");
  assert.deepEqual(recordedPayload, inputPayload);

  const body = await response.json();
  assert.deepEqual(body, {
    session: {
      session_id: "session_1",
      child_id: "child_1"
    }
  });
});
