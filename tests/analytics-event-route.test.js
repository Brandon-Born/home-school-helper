import test from "node:test";
import assert from "node:assert/strict";

import { ApiError } from "../src/server/api-error.js";
import { createAnalyticsEventPostHandler } from "../app/api/analytics/event/route.js";
import { assertApiErrorResponse, createJsonRequest } from "./helpers/route-test-helpers.js";

test("createAnalyticsEventPostHandler returns accepted for valid event", async () => {
  let loggedEvent = null;
  let loggedPayload = null;

  const handler = createAnalyticsEventPostHandler({
    enforceRateLimit: () => {},
    logProductAnalyticsEvent: (event, payload) => {
      loggedEvent = event;
      loggedPayload = payload;
    }
  });

  const response = await handler(
    createJsonRequest("https://example.test/api/analytics/event", {
      event: "child_join",
      payload: { status: "success" }
    })
  );

  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { accepted: true });
  assert.equal(loggedEvent, "child_join");
  assert.deepEqual(loggedPayload, { status: "success" });
});

test("createAnalyticsEventPostHandler returns rate_limited when limiter rejects", async () => {
  const handler = createAnalyticsEventPostHandler({
    enforceRateLimit: () => {
      throw new ApiError(429, "rate_limited", "Too many requests. Please try again shortly.");
    }
  });

  const response = await handler(
    createJsonRequest("https://example.test/api/analytics/event", {
      event: "child_join",
      payload: { status: "success" }
    })
  );

  await assertApiErrorResponse(response, {
    status: 429,
    error: "rate_limited",
    message: "Too many requests. Please try again shortly."
  });
});

test("createAnalyticsEventPostHandler rejects invalid event payload", async () => {
  const handler = createAnalyticsEventPostHandler({
    enforceRateLimit: () => {}
  });

  const response = await handler(
    createJsonRequest("https://example.test/api/analytics/event", {
      event: "child_join",
      payload: { status: "not_valid" }
    })
  );

  await assertApiErrorResponse(response, {
    status: 400,
    error: "validation_error",
    message: "status is required for analytics event 'child_join'."
  });
});
