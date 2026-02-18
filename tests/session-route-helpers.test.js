import test from "node:test";
import assert from "node:assert/strict";

import { ApiError } from "../src/server/api-error.js";
import { readSessionIdParam, runSessionRoute } from "../src/server/session-route-helpers.js";

test("readSessionIdParam resolves promised params and trims whitespace", async () => {
  const sessionId = await readSessionIdParam(Promise.resolve({ id: "  s1  " }));
  assert.equal(sessionId, "s1");
});

test("readSessionIdParam throws invalid_session_id when params are missing or blank", async () => {
  await assert.rejects(
    () => readSessionIdParam(Promise.resolve({})),
    (error) => error instanceof ApiError && error.status === 400 && error.code === "invalid_session_id"
  );
  await assert.rejects(
    () => readSessionIdParam(Promise.resolve({ id: "   " })),
    (error) => error instanceof ApiError && error.status === 400 && error.code === "invalid_session_id"
  );
});

test("runSessionRoute calls run with resolved session id", async () => {
  const response = await runSessionRoute({
    request: new Request("https://example.test"),
    params: Promise.resolve({ id: "s2" }),
    fallbackCode: "route_failed",
    onError: () => Response.json({ error: "unexpected" }, { status: 500 }),
    run: async ({ sessionId }) => {
      assert.equal(sessionId, "s2");
      return Response.json({ ok: true });
    }
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});

test("runSessionRoute forwards failures to onRouteError and onError", async () => {
  const observed = {
    onRouteErrorSessionId: null,
    onErrorFallback: null,
    onErrorSessionId: null
  };

  const response = await runSessionRoute({
    request: new Request("https://example.test"),
    params: Promise.resolve({ id: "s3" }),
    fallbackCode: "route_failed",
    onRouteError: ({ sessionId }) => {
      observed.onRouteErrorSessionId = sessionId;
    },
    onError: (_error, fallbackCode, context) => {
      observed.onErrorFallback = fallbackCode;
      observed.onErrorSessionId = context.sessionId;
      return Response.json({ error: fallbackCode }, { status: 500 });
    },
    run: async () => {
      throw new Error("boom");
    }
  });

  assert.equal(response.status, 500);
  assert.equal(observed.onRouteErrorSessionId, "s3");
  assert.equal(observed.onErrorFallback, "route_failed");
  assert.equal(observed.onErrorSessionId, "s3");
});
