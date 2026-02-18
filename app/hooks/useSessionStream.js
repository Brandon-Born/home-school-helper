"use client";

import { useEffect } from "react";
import { openEventStream } from "../../src/lib/event-stream.js";

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
    if (!sessionId || !accessToken) {
      return;
    }

    let disposed = false;
    let reconnectTimer;
    let streamAbortController;

    const scheduleReconnect = (delayMs) => {
      if (disposed) {
        return;
      }

      reconnectTimer = window.setTimeout(() => {
        void connect();
      }, delayMs);
    };

    const connect = async () => {
      streamAbortController = new AbortController();

      try {
        await openEventStream({
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

        if (!disposed) {
          scheduleReconnect(reconnectDelayMs);
        }
      } catch (streamError) {
        if (disposed) {
          return;
        }

        const outcome = await onDisconnect(streamError);
        if (disposed || outcome === "stop") {
          return;
        }

        if (outcome === "reconnect_soon") {
          scheduleReconnect(fastReconnectDelayMs);
          return;
        }

        scheduleReconnect(reconnectDelayMs);
      }
    };

    void connect();

    return () => {
      disposed = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      if (streamAbortController) {
        streamAbortController.abort();
      }
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
