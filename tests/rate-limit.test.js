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

test("enforceRateLimit blocks requests over threshold inside window", async () => {
  resetRateLimitStore();
  const request = makeRequest();

  await enforceRateLimit(request, {
    scope: "session_join",
    maxRequests: 2,
    windowMs: 60_000
  }, { nowMs: 10_000, backend: "memory" });

  await enforceRateLimit(request, {
    scope: "session_join",
    maxRequests: 2,
    windowMs: 60_000
  }, { nowMs: 10_100, backend: "memory" });

  await assert.rejects(
    () =>
      enforceRateLimit(request, {
        scope: "session_join",
        maxRequests: 2,
        windowMs: 60_000
      }, { nowMs: 10_200, backend: "memory" }),
    (error) => error instanceof ApiError && error.status === 429 && error.code === "rate_limited"
  );
});

test("enforceRateLimit resets counters after window boundary", async () => {
  resetRateLimitStore();
  const request = makeRequest();

  await enforceRateLimit(request, {
    scope: "child_turn",
    maxRequests: 1,
    windowMs: 1000
  }, { nowMs: 1_000, backend: "memory" });

  await assert.doesNotReject(() =>
    enforceRateLimit(request, {
      scope: "child_turn",
      maxRequests: 1,
      windowMs: 1000
    }, { nowMs: 2_001, backend: "memory" })
  );
});

test("enforceRateLimit supports distributed custom store adapter", async () => {
  resetRateLimitStore();
  const request = makeRequest();
  const store = {
    calls: 0,
    async acquire() {
      this.calls += 1;
      return { allowed: this.calls === 1 };
    }
  };

  await enforceRateLimit(request, {
    scope: "session_start",
    maxRequests: 20,
    windowMs: 60_000
  }, { backend: "supabase", store });

  await assert.rejects(
    () =>
      enforceRateLimit(request, {
        scope: "session_start",
        maxRequests: 20,
        windowMs: 60_000
      }, { backend: "supabase", store }),
    (error) => error instanceof ApiError && error.status === 429 && error.code === "rate_limited"
  );
});
