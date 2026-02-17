import test from "node:test";
import assert from "node:assert/strict";

import { ApiError } from "../src/server/api-error.js";
import { enforceRateLimit, resetRateLimitStore } from "../src/server/rate-limit.js";

function makeRequest(ip = "203.0.113.10") {
  return new Request("https://example.test/api/test", {
    headers: {
      "x-forwarded-for": ip
    }
  });
}

test("enforceRateLimit blocks requests over threshold inside window", () => {
  resetRateLimitStore();
  const request = makeRequest();

  enforceRateLimit(request, {
    scope: "session_join",
    maxRequests: 2,
    windowMs: 60_000
  }, { nowMs: 10_000 });

  enforceRateLimit(request, {
    scope: "session_join",
    maxRequests: 2,
    windowMs: 60_000
  }, { nowMs: 10_100 });

  assert.throws(
    () =>
      enforceRateLimit(request, {
        scope: "session_join",
        maxRequests: 2,
        windowMs: 60_000
      }, { nowMs: 10_200 }),
    (error) => error instanceof ApiError && error.status === 429 && error.code === "rate_limited"
  );
});

test("enforceRateLimit resets counters after window boundary", () => {
  resetRateLimitStore();
  const request = makeRequest();

  enforceRateLimit(request, {
    scope: "child_turn",
    maxRequests: 1,
    windowMs: 1000
  }, { nowMs: 1_000 });

  assert.doesNotThrow(() =>
    enforceRateLimit(request, {
      scope: "child_turn",
      maxRequests: 1,
      windowMs: 1000
    }, { nowMs: 2_001 })
  );
});
