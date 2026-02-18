import test from "node:test";
import assert from "node:assert/strict";

import { ApiError } from "../src/server/api-error.js";
import { createStreamGetHandler, serializeSse } from "../app/api/session/[id]/stream/route.js";
import {
  assertApiErrorResponse,
  parseSseEvents
} from "./helpers/route-test-helpers.js";

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
    createSessionMessageSubscription: async () => async () => {},
    setTimer: () => ({ timer: true }),
    clearTimer: () => {},
    logStreamEvent: () => {}
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
    limit: 20,
    order: "desc"
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
    createSessionMessageSubscription: async () => async () => {},
    setTimer: () => ({ timer: true }),
    clearTimer: () => {},
    logStreamEvent: () => {}
  });

  const response = await handler(new Request("https://example.test/api/session/s1/stream"), {
    params: { id: "s1" }
  });

  assert.equal(response.status, 200);
  assert.equal(listCalls.length, 1);
  assert.deepEqual(listCalls[0], {
    sessionId: "s1",
    visibility: "all",
    limit: 150,
    order: "desc"
  });
});

test("createStreamGetHandler returns JSON error response for viewer resolution failures", async () => {
  const handler = createStreamGetHandler({
    resolveSessionViewerContext: async () => {
      throw new ApiError(403, "session_forbidden", "Forbidden");
    },
    createSessionMessageSubscription: async () => async () => {},
    logStreamEvent: () => {}
  });

  const response = await handler(new Request("https://example.test/api/session/s1/stream"), {
    params: { id: "s1" }
  });

  await assertApiErrorResponse(response, {
    status: 403,
    error: "session_forbidden",
    message: "Forbidden"
  });
});

test("createStreamGetHandler emits snapshot then ordered message_append events", async () => {
  const pollCallbacks = [];
  let listCallCount = 0;
  const seededRows = [
    [
      {
        id: "m1",
        actor_type: "child",
        visibility_scope: "child_and_parent",
        content: "first",
        created_at: "2026-02-17T00:00:00.000Z"
      }
    ],
    [
      {
        id: "m1",
        actor_type: "child",
        visibility_scope: "child_and_parent",
        content: "first",
        created_at: "2026-02-17T00:00:00.000Z"
      },
      {
        id: "m2",
        actor_type: "assistant",
        visibility_scope: "child_and_parent",
        content: "second",
        created_at: "2026-02-17T00:00:01.000Z"
      },
      {
        id: "m3",
        actor_type: "assistant",
        visibility_scope: "child_and_parent",
        content: "third",
        created_at: "2026-02-17T00:00:02.000Z"
      }
    ]
  ];

  const handler = createStreamGetHandler({
    resolveSessionViewerContext: async () => ({ role: "child", visibility: "child" }),
    listSessionMessages: async () => {
      const index = Math.min(listCallCount, seededRows.length - 1);
      listCallCount += 1;
      return seededRows[index];
    },
    createSessionMessageSubscription: async () => async () => {},
    streamTransportMode: "polling",
    setTimer: (callback, interval) => {
      if (interval === 1800) {
        pollCallbacks.push(callback);
      }
      return { interval };
    },
    clearTimer: () => {},
    logStreamEvent: () => {}
  });

  const abortController = new AbortController();
  const request = new Request("https://example.test/api/session/s1/stream?limit=10", {
    signal: abortController.signal
  });
  const response = await handler(request, {
    params: { id: "s1" }
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  const firstChunk = await reader.read();
  assert.equal(firstChunk.done, false);
  const snapshotEvents = parseSseEvents(decoder.decode(firstChunk.value));
  assert.equal(snapshotEvents.length, 1);
  assert.equal(snapshotEvents[0].event, "snapshot");
  assert.deepEqual(
    snapshotEvents[0].data.messages.map((message) => message.id),
    ["m1"]
  );

  assert.equal(typeof pollCallbacks[0], "function");
  const pollPromise = pollCallbacks[0]();
  const secondChunk = await reader.read();
  await pollPromise;
  assert.equal(secondChunk.done, false);
  const appendEvents = parseSseEvents(decoder.decode(secondChunk.value));
  assert.equal(appendEvents.length, 1);
  assert.equal(appendEvents[0].event, "message_append");
  assert.deepEqual(
    appendEvents[0].data.messages.map((message) => message.id),
    ["m2", "m3"]
  );

  abortController.abort();
  await reader.cancel();
});

test("createStreamGetHandler cursor advances with created_at and id", async () => {
  const pollCallbacks = [];
  let listCallCount = 0;
  const seededRows = [
    [
      {
        id: "m100",
        actor_type: "assistant",
        visibility_scope: "child_and_parent",
        content: "base",
        created_at: "2026-02-17T00:00:00.000Z"
      }
    ],
    [
      {
        id: "m099",
        actor_type: "assistant",
        visibility_scope: "child_and_parent",
        content: "older id same timestamp",
        created_at: "2026-02-17T00:00:00.000Z"
      },
      {
        id: "m100",
        actor_type: "assistant",
        visibility_scope: "child_and_parent",
        content: "base",
        created_at: "2026-02-17T00:00:00.000Z"
      },
      {
        id: "m101",
        actor_type: "assistant",
        visibility_scope: "child_and_parent",
        content: "newer id same timestamp",
        created_at: "2026-02-17T00:00:00.000Z"
      },
      {
        id: "m102",
        actor_type: "assistant",
        visibility_scope: "child_and_parent",
        content: "later timestamp",
        created_at: "2026-02-17T00:00:01.000Z"
      }
    ]
  ];

  const handler = createStreamGetHandler({
    resolveSessionViewerContext: async () => ({ role: "child", visibility: "child" }),
    listSessionMessages: async () => {
      const index = Math.min(listCallCount, seededRows.length - 1);
      listCallCount += 1;
      return seededRows[index];
    },
    createSessionMessageSubscription: async () => async () => {},
    streamTransportMode: "polling",
    setTimer: (callback, interval) => {
      if (interval === 1800) {
        pollCallbacks.push(callback);
      }
      return { interval };
    },
    clearTimer: () => {},
    logStreamEvent: () => {}
  });

  const abortController = new AbortController();
  const response = await handler(
    new Request("https://example.test/api/session/s1/stream?limit=10", {
      signal: abortController.signal
    }),
    { params: { id: "s1" } }
  );

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  const firstChunk = await reader.read();
  assert.equal(firstChunk.done, false);
  const snapshotEvents = parseSseEvents(decoder.decode(firstChunk.value));
  assert.equal(snapshotEvents[0].event, "snapshot");
  assert.deepEqual(
    snapshotEvents[0].data.messages.map((message) => message.id),
    ["m100"]
  );

  const pollPromise = pollCallbacks[0]();
  const secondChunk = await reader.read();
  await pollPromise;
  assert.equal(secondChunk.done, false);
  const appendEvents = parseSseEvents(decoder.decode(secondChunk.value));
  assert.equal(appendEvents[0].event, "message_append");
  assert.deepEqual(
    appendEvents[0].data.messages.map((message) => message.id),
    ["m101", "m102"]
  );

  abortController.abort();
  await reader.cancel();
});

test("createStreamGetHandler emits structured telemetry for connect and abort close", async () => {
  const telemetryEvents = [];

  const handler = createStreamGetHandler({
    resolveSessionViewerContext: async () => ({ role: "parent", visibility: "all", parent_id: "p1" }),
    listSessionMessages: async () => [],
    createSessionMessageSubscription: async () => async () => {},
    setTimer: () => ({ timer: true }),
    clearTimer: () => {},
    logStreamEvent: (_level, payload) => {
      telemetryEvents.push(payload);
    }
  });

  const abortController = new AbortController();
  const response = await handler(
    new Request("https://example.test/api/session/s1/stream?limit=25", {
      signal: abortController.signal
    }),
    { params: { id: "s1" } }
  );
  assert.equal(response.status, 200);

  const reader = response.body.getReader();
  await reader.read();

  abortController.abort();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await reader.cancel();

  assert.equal(
    telemetryEvents.some(
      (event) =>
        event.event === "stream_connect" &&
        event.session_id === "s1" &&
        event.viewer_role === "parent" &&
        event.visibility === "all"
    ),
    true
  );
  assert.equal(
    telemetryEvents.some(
      (event) =>
        event.event === "stream_disconnect" && event.session_id === "s1" && event.reason === "client_abort"
    ),
    true
  );
});
