"use client";

import { useCallback } from "react";

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

        setLoadingState("nudge", true);
        setError("");
        clearActionAlert("nudge");

        try {
          const payload = await parentRequest(`/api/session/${activeSessionId}/parent-nudge`, {
            method: "POST",
            body: {
              nudge_text: nudgeText.trim(),
              parent_guidance: nudgeText.trim()
            }
          });

          setActionAlert("nudge", "success", payload.assistant_text || "Private note sent.");
          setNudgeText("");
        } catch (requestError) {
          setActionAlert(
            "nudge",
            "error",
            requestError instanceof Error ? requestError.message : "We couldn't send that private note. Please try again."
          );
        } finally {
          setLoadingState("nudge", false);
        }
      },
      [activeSessionId, clearActionAlert, nudgeText, parentRequest, setActionAlert, setError, setLoadingState, setNudgeText]
    );

    const setOverride = useCallback(
      async (enabled) => {
        if (!activeSessionId) {
          return;
        }

        setLoadingState("override", true);
        setError("");
        clearActionAlert("override");

        try {
          await parentRequest(`/api/session/${activeSessionId}/override`, {
            method: "POST",
            body: {
              enabled,
              duration_minutes: 15
            }
          });
          setActionAlert(
            "override",
            "success",
            enabled ? "Direct-answer mode enabled for 15 minutes." : "Back to guided mode."
          );
        } catch (requestError) {
          setActionAlert(
            "override",
            "error",
            requestError instanceof Error ? requestError.message : "We couldn't update direct-answer mode. Please try again."
          );
        } finally {
          setLoadingState("override", false);
        }
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
