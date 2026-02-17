import test from "node:test";
import assert from "node:assert/strict";

import { createMessagesGetHandler } from "../app/api/session/[id]/messages/route.js";

test("createMessagesGetHandler returns messages with resolved viewer visibility", async () => {
  const recorded = {
    viewer: null,
    listArgs: null
  };

  const handler = createMessagesGetHandler({
    resolveSessionViewerContext: async (_request, sessionId) => {
      recorded.viewer = sessionId;
      return { role: "child", visibility: "child" };
    },
    listSessionMessages: async (args) => {
      recorded.listArgs = args;
      return [{ id: "m1", content: "hello" }];
    }
  });

  const response = await handler(new Request("https://example.test/api/session/s1/messages?limit=77"), {
    params: { id: "s1" }
  });

  assert.equal(response.status, 200);
  const payload = await response.json();

  assert.equal(recorded.viewer, "s1");
  assert.deepEqual(recorded.listArgs, {
    sessionId: "s1",
    visibility: "child",
    limit: 77
  });
  assert.deepEqual(payload, {
    messages: [{ id: "m1", content: "hello" }],
    visibility: "child"
  });
});

test("createMessagesGetHandler delegates failures to route error handler", async () => {
  const handler = createMessagesGetHandler({
    resolveSessionViewerContext: async () => {
      throw new Error("explode");
    },
    handleRouteError: (error, fallbackCode) =>
      new Response(
        JSON.stringify({
          fallbackCode,
          message: error.message
        }),
        {
          status: 500,
          headers: {
            "content-type": "application/json"
          }
        }
      )
  });

  const response = await handler(new Request("https://example.test/api/session/s1/messages"), {
    params: { id: "s1" }
  });

  assert.equal(response.status, 500);
  const payload = await response.json();
  assert.deepEqual(payload, {
    fallbackCode: "messages_fetch_failed",
    message: "explode"
  });
});
