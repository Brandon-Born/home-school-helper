"use client";

import { useCallback } from "react";
import { isParentAuthFailure } from "../../../src/lib/auth-failures.js";
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
        const refreshedSession = await refreshParentSession();
        if (refreshedSession?.access_token) {
          setError("Refreshing parent session...");
          return "reconnect_soon";
        }

        await invalidateParentSession("Parent session expired while streaming. Please sign in again.");
        return "stop";
      }

      setError(streamError instanceof Error ? streamError.message : "Stream disconnected.");
      return "reconnect";
    },
    [invalidateParentSession, refreshParentSession, setError]
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
