"use client";

import { useEffect } from "react";
import { openEventStream } from "../../src/lib/event-stream.js";
import { getStreamErrorDetails, logClientStreamTelemetry } from "../../src/lib/stream-telemetry.js";

export function createSessionStreamController({
  sessionId,
  accessToken,
  limit = 200,
  reconnectDelayMs = 1800,
  fastReconnectDelayMs = 500,
  onSnapshot,
  onAppend,
  onStreamError,
  onDisconnect,
  openStream = openEventStream,
  setTimer = (callback, delay) => window.setTimeout(callback, delay),
  clearTimer = (timerId) => window.clearTimeout(timerId),
  createAbortController = () => new AbortController()
}) {
  if (!sessionId || !accessToken) {
    return {
      start() {},
      dispose() {}
    };
  }

  let disposed = false;
  let reconnectTimer;
  let streamAbortController;
  let connectAttempts = 0;
  let reconnectSchedules = 0;

  const scheduleReconnect = (delayMs, reason) => {
    if (disposed) {
      return;
    }

    reconnectSchedules += 1;
    logClientStreamTelemetry("info", {
      event: "stream_reconnect_scheduled",
      session_id: sessionId,
      delay_ms: delayMs,
      reason: reason || "unknown",
      reconnect_schedule_count: reconnectSchedules
    });

    reconnectTimer = setTimer(() => {
      void connect("scheduled_reconnect");
    }, delayMs);
  };

  const connect = async (trigger = "initial") => {
    streamAbortController = createAbortController();
    connectAttempts += 1;
    const connectedAtMs = Date.now();
    logClientStreamTelemetry("info", {
      event: "stream_connect_attempt",
      session_id: sessionId,
      trigger,
      connect_attempt: connectAttempts
    });

    try {
      await openStream({
        path: `/api/session/${sessionId}/stream?limit=${limit}`,
        bearerToken: accessToken,
        signal: streamAbortController.signal,
        onEvent: ({ event, data }) => {
          if (disposed) {
            return;
          }

          if (event === "snapshot") {
            onSnapshot(data?.messages ?? []);
            return;
          }

          if (event === "message_append") {
            onAppend(data?.messages ?? []);
            return;
          }

          if (event === "error") {
            onStreamError(data?.message || "Stream error.");
          }
        }
      });

      logClientStreamTelemetry("info", {
        event: "stream_disconnect",
        session_id: sessionId,
        disconnect_type: "clean_eof",
        connection_duration_ms: Date.now() - connectedAtMs
      });

      if (!disposed) {
        scheduleReconnect(reconnectDelayMs, "stream_eof");
      }
    } catch (streamError) {
      if (disposed) {
        return;
      }

      const outcome = await onDisconnect(streamError);
      logClientStreamTelemetry("warn", {
        event: "stream_disconnect",
        session_id: sessionId,
        disconnect_type: "error",
        reconnect_outcome: outcome || "reconnect",
        connection_duration_ms: Date.now() - connectedAtMs,
        ...getStreamErrorDetails(streamError)
      });
      if (disposed || outcome === "stop") {
        return;
      }

      if (outcome === "reconnect_soon") {
        scheduleReconnect(fastReconnectDelayMs, "reconnect_soon");
        return;
      }

      scheduleReconnect(reconnectDelayMs, "reconnect");
    }
  };

  return {
    start() {
      void connect();
    },
    dispose() {
      disposed = true;
      logClientStreamTelemetry("info", {
        event: "stream_disconnect",
        session_id: sessionId,
        disconnect_type: "client_dispose"
      });
      if (reconnectTimer) {
        clearTimer(reconnectTimer);
      }
      if (streamAbortController) {
        streamAbortController.abort();
      }
    }
  };
}

export function useSessionStream({
  sessionId,
  accessToken,
  limit = 200,
  reconnectDelayMs = 1800,
  fastReconnectDelayMs = 500,
  onSnapshot,
  onAppend,
  onStreamError,
  onDisconnect
}) {
  useEffect(() => {
    const controller = createSessionStreamController({
      sessionId,
      accessToken,
      limit,
      reconnectDelayMs,
      fastReconnectDelayMs,
      onSnapshot,
      onAppend,
      onStreamError,
      onDisconnect
    });
    controller.start();

    return () => {
      controller.dispose();
    };
  }, [
    accessToken,
    fastReconnectDelayMs,
    limit,
    onAppend,
    onDisconnect,
    onSnapshot,
    onStreamError,
    reconnectDelayMs,
    sessionId
  ]);
}
