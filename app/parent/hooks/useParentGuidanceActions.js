"use client";

import { useCallback } from "react";
import { runAsyncActionStatus } from "./parent-action-status.js";

export function createUseParentGuidanceActions() {
  return function useParentGuidanceActions({
    parentRequest,
    activeSessionId,
    nudgeText,
    setNudgeText,
    setLoadingState,
    setError,
    clearActionAlert,
    setActionAlert
  }) {
    const sendNudge = useCallback(
      async (event) => {
        event.preventDefault();
        if (!activeSessionId || !nudgeText.trim()) {
          return;
        }

        await runAsyncActionStatus({
          actionKey: "nudge",
          setLoadingState,
          setError,
          clearActionAlert,
          setActionAlert,
          fallbackErrorMessage: "We couldn't send that private note. Please try again.",
          run: async () => {
            return parentRequest(`/api/session/${activeSessionId}/parent-nudge`, {
              method: "POST",
              body: {
                nudge_text: nudgeText.trim(),
                parent_guidance: nudgeText.trim()
              }
            });
          },
          onSuccess: (payload) => {
            setNudgeText("");
            return payload.assistant_text || "Private note sent.";
          }
        });
      },
      [activeSessionId, clearActionAlert, nudgeText, parentRequest, setActionAlert, setError, setLoadingState, setNudgeText]
    );

    const setOverride = useCallback(
      async (enabled) => {
        if (!activeSessionId) {
          return;
        }

        await runAsyncActionStatus({
          actionKey: "override",
          setLoadingState,
          setError,
          clearActionAlert,
          setActionAlert,
          fallbackErrorMessage: "We couldn't update direct-answer mode. Please try again.",
          run: async () => {
            await parentRequest(`/api/session/${activeSessionId}/override`, {
              method: "POST",
              body: {
                enabled,
                duration_minutes: 15
              }
            });
          },
          onSuccess: () => {
            return enabled ? "Direct-answer mode enabled for 15 minutes." : "Back to guided mode.";
          }
        });
      },
      [activeSessionId, clearActionAlert, parentRequest, setActionAlert, setError, setLoadingState]
    );

    return {
      sendNudge,
      setOverride
    };
  };
}

export const useParentGuidanceActions = createUseParentGuidanceActions();
