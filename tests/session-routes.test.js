import test from "node:test";
import assert from "node:assert/strict";

import { ApiError } from "../src/server/api-error.js";
import { createSessionJoinPostHandler } from "../app/api/session/join/route.js";
import { createSessionStartPostHandler } from "../app/api/session/start/route.js";

test("createSessionJoinPostHandler returns rate_limited error when limiter rejects", async () => {
  const handler = createSessionJoinPostHandler({
    enforceRateLimit: () => {
      throw new ApiError(429, "rate_limited", "Too many requests. Please try again shortly.");
    }
  });

  const response = await handler(
    new Request("https://example.test/api/session/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "AB12CD34" })
    })
  );

  assert.equal(response.status, 429);
  const payload = await response.json();
  assert.deepEqual(payload, {
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
    new Request("https://example.test/api/session/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ child_id: "child_1", daily_subjects: ["Math"] })
    })
  );

  assert.equal(response.status, 429);
  const payload = await response.json();
  assert.deepEqual(payload, {
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
  const response = await handler(
    new Request("https://example.test/api/session/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(inputPayload)
    })
  );

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
