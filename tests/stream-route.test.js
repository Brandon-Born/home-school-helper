import test from "node:test";
import assert from "node:assert/strict";

import { ApiError } from "../src/server/api-error.js";
import { createStreamGetHandler, serializeSse } from "../app/api/session/[id]/stream/route.js";

test("serializeSse formats event payload blocks", () => {
  const encoded = serializeSse("snapshot", { visibility: "child" });
  const decoded = new TextDecoder().decode(encoded);

  assert.equal(decoded, 'event: snapshot\ndata: {"visibility":"child"}\n\n');
});

test("createStreamGetHandler uses child visibility when viewer is child", async () => {
  const listCalls = [];

  const handler = createStreamGetHandler({
    resolveSessionViewerContext: async () => ({ role: "child", visibility: "child" }),
    listSessionMessages: async (args) => {
      listCalls.push(args);
      return [];
    },
    setTimer: () => ({ timer: true }),
    clearTimer: () => {}
  });

  const response = await handler(new Request("https://example.test/api/session/s1/stream?limit=20"), {
    params: { id: "s1" }
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/event-stream; charset=utf-8");
  assert.equal(listCalls.length, 1);
  assert.deepEqual(listCalls[0], {
    sessionId: "s1",
    visibility: "child",
    limit: 20
  });
});

test("createStreamGetHandler uses full visibility when viewer is parent", async () => {
  const listCalls = [];

  const handler = createStreamGetHandler({
    resolveSessionViewerContext: async () => ({ role: "parent", visibility: "all", parent_id: "p1" }),
    listSessionMessages: async (args) => {
      listCalls.push(args);
      return [];
    },
    setTimer: () => ({ timer: true }),
    clearTimer: () => {}
  });

  const response = await handler(new Request("https://example.test/api/session/s1/stream"), {
    params: { id: "s1" }
  });

  assert.equal(response.status, 200);
  assert.equal(listCalls.length, 1);
  assert.deepEqual(listCalls[0], {
    sessionId: "s1",
    visibility: "all",
    limit: 150
  });
});

test("createStreamGetHandler returns JSON error response for viewer resolution failures", async () => {
  const handler = createStreamGetHandler({
    resolveSessionViewerContext: async () => {
      throw new ApiError(403, "session_forbidden", "Forbidden");
    }
  });

  const response = await handler(new Request("https://example.test/api/session/s1/stream"), {
    params: { id: "s1" }
  });

  assert.equal(response.status, 403);
  const payload = await response.json();
  assert.deepEqual(payload, {
    error: "session_forbidden",
    message: "Forbidden"
  });
});
