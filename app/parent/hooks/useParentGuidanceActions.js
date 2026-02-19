"use client";

import { useCallback } from "react";
import { trackProductEvent } from "../../../src/lib/product-analytics.js";
import { runAsyncActionStatus } from "./parent-action-status.js";

export function createUseParentGuidanceActions({
  trackProductEventImpl = trackProductEvent
} = {}) {
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
        const trimmedNudge = nudgeText.trim();

        const outcome = await runAsyncActionStatus({
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
                nudge_text: trimmedNudge,
                parent_guidance: trimmedNudge
              }
            });
          },
          onSuccess: (payload) => {
            setNudgeText("");
            return payload.assistant_text || "Private note sent.";
          }
        });
        trackProductEventImpl("nudge_send", {
          status: outcome.ok ? "success" : "failed"
        });
      },
      [activeSessionId, clearActionAlert, nudgeText, parentRequest, setActionAlert, setError, setLoadingState, setNudgeText, trackProductEventImpl]
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
