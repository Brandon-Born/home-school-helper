"use client";

import { useCallback } from "react";
import { isParentAuthFailure } from "../../../src/lib/auth-failures.js";
import { getStreamErrorDetails, logClientStreamTelemetry } from "../../../src/lib/stream-telemetry.js";
import { useSessionStream } from "../../hooks/useSessionStream.js";

export function useParentTranscriptStream({
  activeSessionId,
  accessToken,
  refreshParentSession,
  invalidateParentSession,
  onSnapshot,
  onAppend,
  setError
}) {
  const handleDisconnect = useCallback(
    async (streamError) => {
      if (isParentAuthFailure(streamError)) {
        logClientStreamTelemetry("info", {
          event: "stream_auth_refresh",
          session_id: activeSessionId,
          status: "attempt",
          ...getStreamErrorDetails(streamError)
        });
        const refreshedSession = await refreshParentSession();
        if (refreshedSession?.access_token) {
          logClientStreamTelemetry("info", {
            event: "stream_auth_refresh",
            session_id: activeSessionId,
            status: "success"
          });
          setError("Refreshing parent session...");
          return "reconnect_soon";
        }

        logClientStreamTelemetry("warn", {
          event: "stream_auth_refresh",
          session_id: activeSessionId,
          status: "failed"
        });
        await invalidateParentSession("Parent session expired while streaming. Please sign in again.");
        return "stop";
      }

      setError(streamError instanceof Error ? streamError.message : "Stream disconnected.");
      return "reconnect";
    },
    [activeSessionId, invalidateParentSession, refreshParentSession, setError]
  );

  const handleSnapshot = useCallback(
    (messages) => {
      onSnapshot(messages);
      setError("");
    },
    [onSnapshot, setError]
  );

  useSessionStream({
    sessionId: activeSessionId,
    accessToken,
    onSnapshot: handleSnapshot,
    onAppend,
    onStreamError: setError,
    onDisconnect: handleDisconnect
  });
}
