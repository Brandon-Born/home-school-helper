import test from "node:test";
import assert from "node:assert/strict";

import { parseSseEvents } from "./helpers/route-test-helpers.js";
import { startTranscriptStreamRuntime } from "../src/server/transcript-stream-runtime.js";

test("startTranscriptStreamRuntime emits poll error and recovery telemetry", async () => {
  const pollCallbacks = [];
  const telemetryEvents = [];
  const writer = {
    write: async () => {},
    close: async () => {}
  };
  let listCalls = 0;

  const runtime = await startTranscriptStreamRuntime({
    writer,
    sessionId: "s_runtime",
    visibility: "child",
    limit: 20,
    listSessionMessages: async () => {
      listCalls += 1;
      if (listCalls === 1) {
        return [];
      }
      if (listCalls === 2) {
        throw new Error("poll failed");
      }
      return [];
    },
    setTimer: (callback, interval) => {
      if (interval === 1800) {
        pollCallbacks.push(callback);
      }
      return { interval };
    },
    clearTimer: () => {},
    logStreamEvent: (_level, payload) => {
      telemetryEvents.push(payload);
    }
  });

  await pollCallbacks[0]();
  await pollCallbacks[0]();
  await runtime.close("test_close");

  assert.equal(
    telemetryEvents.some(
      (event) =>
        event.event === "stream_poll_error" &&
        event.session_id === "s_runtime" &&
        event.visibility === "child" &&
        event.error_message === "poll failed"
    ),
    true
  );
  assert.equal(
    telemetryEvents.some(
      (event) =>
        event.event === "stream_poll_recovered" &&
        event.session_id === "s_runtime" &&
        event.visibility === "child"
    ),
    true
  );
  assert.equal(
    telemetryEvents.some(
      (event) =>
        event.event === "stream_disconnect" && event.session_id === "s_runtime" && event.reason === "test_close"
    ),
    true
  );
});

test("startTranscriptStreamRuntime streams realtime inserts without polling fallback", async () => {
  const pollCallbacks = [];
  const chunks = [];
  let realtimeOnMessage = null;
  let unsubscribed = false;

  const runtime = await startTranscriptStreamRuntime({
    writer: {
      write: async (chunk) => {
        chunks.push(new TextDecoder().decode(chunk));
      },
      close: async () => {}
    },
    sessionId: "s_realtime",
    visibility: "child",
    limit: 20,
    listSessionMessages: async () => [
      {
        id: "m1",
        actor_type: "child",
        visibility_scope: "child_and_parent",
        content: "first",
        created_at: "2026-02-17T00:00:00.000Z",
        policy_flags: []
      }
    ],
    createSessionMessageSubscription: async ({ onMessage }) => {
      realtimeOnMessage = onMessage;
      return async () => {
        unsubscribed = true;
      };
    },
    setTimer: (callback, interval) => {
      if (interval === 1800) {
        pollCallbacks.push(callback);
      }
      return { interval };
    },
    clearTimer: () => {}
  });

  assert.equal(typeof realtimeOnMessage, "function");
  assert.equal(pollCallbacks.length, 0);

  await realtimeOnMessage({
    id: "m2",
    actor_type: "assistant",
    visibility_scope: "child_and_parent",
    content: "second",
    created_at: "2026-02-17T00:00:01.000Z",
    policy_flags: []
  });
  await realtimeOnMessage({
    id: "m3",
    actor_type: "parent",
    visibility_scope: "parent_only",
    content: "hidden",
    created_at: "2026-02-17T00:00:02.000Z",
    policy_flags: []
  });

  await runtime.close("test_close");
  assert.equal(unsubscribed, true);

  const events = parseSseEvents(chunks.join(""));
  assert.equal(events[0].event, "snapshot");
  assert.deepEqual(
    events[0].data.messages.map((message) => message.id),
    ["m1"]
  );
  assert.equal(events[1].event, "message_append");
  assert.deepEqual(
    events[1].data.messages.map((message) => message.id),
    ["m2"]
  );
});

test("startTranscriptStreamRuntime keeps realtime subscribe/unsubscribe balanced across reconnect cycles", async () => {
  let activeSubscriptions = 0;
  let totalSubscriptions = 0;
  let totalUnsubscriptions = 0;
  const telemetryEvents = [];

  for (let cycle = 0; cycle < 4; cycle += 1) {
    const runtime = await startTranscriptStreamRuntime({
      writer: {
        write: async () => {},
        close: async () => {}
      },
      sessionId: `s_cycle_${cycle}`,
      visibility: "all",
      limit: 10,
      listSessionMessages: async () => [],
      createSessionMessageSubscription: async () => {
        activeSubscriptions += 1;
        totalSubscriptions += 1;
        return async () => {
          activeSubscriptions -= 1;
          totalUnsubscriptions += 1;
        };
      },
      setTimer: () => ({ timer: true }),
      clearTimer: () => {},
      logStreamEvent: (_level, payload) => {
        telemetryEvents.push(payload);
      }
    });

    await runtime.close("cycle_close");
  }

  assert.equal(activeSubscriptions, 0);
  assert.equal(totalSubscriptions, 4);
  assert.equal(totalUnsubscriptions, 4);
  assert.equal(
    telemetryEvents.filter((event) => event.event === "stream_realtime_subscribe" && event.status === "subscribed")
      .length,
    4
  );
  assert.equal(
    telemetryEvents.filter((event) => event.event === "stream_realtime_unsubscribe").length,
    4
  );
});

test("startTranscriptStreamRuntime does not drop realtime rows that share a created_at timestamp", async () => {
  const chunks = [];
  let realtimeOnMessage = null;

  const runtime = await startTranscriptStreamRuntime({
    writer: {
      write: async (chunk) => {
        chunks.push(new TextDecoder().decode(chunk));
      },
      close: async () => {}
    },
    sessionId: "s_same_timestamp",
    visibility: "child",
    limit: 20,
    listSessionMessages: async () => [],
    createSessionMessageSubscription: async ({ onMessage }) => {
      realtimeOnMessage = onMessage;
      return async () => {};
    },
    setTimer: () => ({ timer: true }),
    clearTimer: () => {}
  });

  await realtimeOnMessage({
    id: "z-row",
    actor_type: "child",
    visibility_scope: "child_and_parent",
    content: "first",
    created_at: "2026-02-18T12:00:00.000Z",
    policy_flags: []
  });
  await realtimeOnMessage({
    id: "a-row",
    actor_type: "assistant",
    visibility_scope: "child_and_parent",
    content: "second",
    created_at: "2026-02-18T12:00:00.000Z",
    policy_flags: []
  });

  await runtime.close("test_close");

  const events = parseSseEvents(chunks.join(""));
  const appendedIds = events
    .filter((event) => event.event === "message_append")
    .flatMap((event) => event.data.messages.map((message) => message.id));

  assert.deepEqual(appendedIds, ["z-row", "a-row"]);
});
