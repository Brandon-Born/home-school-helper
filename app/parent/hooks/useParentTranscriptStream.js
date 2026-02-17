"use client";

import { useEffect } from "react";
import { openEventStream } from "../../../src/lib/event-stream.js";
import { isParentAuthFailure } from "../../../src/lib/auth-failures.js";

export function useParentTranscriptStream({
  activeSessionId,
  accessToken,
  refreshParentSession,
  invalidateParentSession,
  onSnapshot,
  onAppend,
  setError
}) {
  useEffect(() => {
    if (!activeSessionId || !accessToken) {
      return;
    }

    let disposed = false;
    let reconnectTimer;
    let streamAbortController;

    const connect = async () => {
      streamAbortController = new AbortController();

      try {
        await openEventStream({
          path: `/api/session/${activeSessionId}/stream?limit=200`,
          bearerToken: accessToken,
          signal: streamAbortController.signal,
          onEvent: ({ event, data }) => {
            if (disposed) {
              return;
            }

            if (event === "snapshot") {
              onSnapshot(data.messages ?? []);
              setError("");
              return;
            }

            if (event === "message_append") {
              onAppend(data.messages ?? []);
              return;
            }

            if (event === "error") {
              setError(data?.message || "Stream error.");
            }
          }
        });
      } catch (streamError) {
        if (disposed) {
          return;
        }

        if (isParentAuthFailure(streamError)) {
          const refreshedSession = await refreshParentSession();
          if (disposed) {
            return;
          }

          if (refreshedSession?.access_token) {
            setError("Refreshing parent session...");
            reconnectTimer = window.setTimeout(connect, 500);
            return;
          }

          await invalidateParentSession("Parent session expired while streaming. Please sign in again.");
          return;
        }

        setError(streamError instanceof Error ? streamError.message : "Stream disconnected.");
        reconnectTimer = window.setTimeout(connect, 1800);
      }
    };

    connect();

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
    activeSessionId,
    invalidateParentSession,
    onAppend,
    onSnapshot,
    refreshParentSession,
    setError
  ]);
}
