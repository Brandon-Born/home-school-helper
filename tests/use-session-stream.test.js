import test from "node:test";
import assert from "node:assert/strict";

import { createSessionStreamController } from "../app/hooks/useSessionStream.js";

const originalClientTelemetrySetting = process.env.NEXT_PUBLIC_STREAM_TELEMETRY_DISABLED;
process.env.NEXT_PUBLIC_STREAM_TELEMETRY_DISABLED = "1";
test.after(() => {
  process.env.NEXT_PUBLIC_STREAM_TELEMETRY_DISABLED = originalClientTelemetrySetting;
});

test("createSessionStreamController schedules fast reconnect for reconnect_soon outcome", async () => {
  const timers = [];
  const cleared = [];
  const controller = createSessionStreamController({
    sessionId: "s1",
    accessToken: "token",
    reconnectDelayMs: 1800,
    fastReconnectDelayMs: 500,
    onSnapshot: () => {},
    onAppend: () => {},
    onStreamError: () => {},
    onDisconnect: async () => "reconnect_soon",
    openStream: async () => {
      throw new Error("network");
    },
    setTimer: (_callback, delay) => {
      const timer = { delay };
      timers.push(timer);
      return timer;
    },
    clearTimer: (timer) => {
      cleared.push(timer);
    }
  });

  controller.start();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(timers.length, 1);
  assert.equal(timers[0].delay, 500);

  controller.dispose();
  assert.equal(cleared.length, 1);
  assert.equal(cleared[0], timers[0]);
});

test("createSessionStreamController schedules default reconnect on clean EOF", async () => {
  const timers = [];
  let disconnectCalls = 0;

  const controller = createSessionStreamController({
    sessionId: "s2",
    accessToken: "token",
    reconnectDelayMs: 1800,
    fastReconnectDelayMs: 500,
    onSnapshot: () => {},
    onAppend: () => {},
    onStreamError: () => {},
    onDisconnect: async () => {
      disconnectCalls += 1;
      return "reconnect";
    },
    openStream: async () => {},
    setTimer: (_callback, delay) => {
      const timer = { delay };
      timers.push(timer);
      return timer;
    },
    clearTimer: () => {}
  });

  controller.start();
  await Promise.resolve();

  assert.equal(disconnectCalls, 0);
  assert.equal(timers.length, 1);
  assert.equal(timers[0].delay, 1800);
});

test("createSessionStreamController aborts active stream on dispose", async () => {
  let aborted = false;

  const controller = createSessionStreamController({
    sessionId: "s3",
    accessToken: "token",
    onSnapshot: () => {},
    onAppend: () => {},
    onStreamError: () => {},
    onDisconnect: async () => "stop",
    openStream: async () => new Promise(() => {}),
    createAbortController: () => ({
      signal: {},
      abort() {
        aborted = true;
      }
    }),
    setTimer: () => ({ timer: true }),
    clearTimer: () => {}
  });

  controller.start();
  await Promise.resolve();
  controller.dispose();

  assert.equal(aborted, true);
});
