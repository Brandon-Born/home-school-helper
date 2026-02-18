"use client";

import { useCallback } from "react";
import { buildSessionForUi, toList } from "./parent-console-shared.js";

export function createUseParentSessions() {
  return function useParentSessions({
    parentRequest,
    children,
    selectedChildId,
    sessionForm,
    activeSessionId,
    setLoadingState,
    setError,
    clearActionAlert,
    setActionAlert,
    setActiveSession,
    setActiveSessions,
    setSelectedChildId,
    setMessages
  }) {
    const startSession = useCallback(
      async (event) => {
        event.preventDefault();
        setLoadingState("sessionStart", true);
        setError("");
        clearActionAlert("sessionStart");

        try {
          const payload = await parentRequest("/api/session/start", {
            method: "POST",
            body: {
              child_id: selectedChildId,
              daily_subjects: toList(sessionForm.daily_subjects),
              parent_context: sessionForm.parent_context,
              goal_notes: sessionForm.goal_notes,
              additional_context: sessionForm.additional_context
            }
          });

          const nextSession = buildSessionForUi(payload.session, children);
          setActiveSession(nextSession);
          setActiveSessions((previous) => {
            const rest = previous.filter((sessionRow) => sessionRow.session_id !== nextSession.session_id);
            return [nextSession, ...rest];
          });
          setMessages([]);
          setActionAlert("sessionStart", "success", "Join code is ready to share.");
        } catch (requestError) {
          setActionAlert(
            "sessionStart",
            "error",
            requestError instanceof Error ? requestError.message : "We couldn't start the session. Please try again."
          );
        } finally {
          setLoadingState("sessionStart", false);
        }
      },
      [children, clearActionAlert, parentRequest, selectedChildId, sessionForm, setActionAlert, setActiveSession, setActiveSessions, setError, setLoadingState, setMessages]
    );

    const rejoinSession = useCallback(
      (sessionData) => {
        setActiveSession((previous) =>
          buildSessionForUi(
            sessionData,
            children,
            previous?.session_id === sessionData.session_id ? previous : null
          )
        );
        setSelectedChildId(sessionData.child_id);
        setMessages([]);
        clearActionAlert("nudge");
      },
      [children, clearActionAlert, setActiveSession, setMessages, setSelectedChildId]
    );

    const endSession = useCallback(
      async (sessionId) => {
        setLoadingState("sessionManage", true);
        setError("");
        clearActionAlert("sessionManage");

        try {
          await parentRequest(`/api/session/${sessionId}/manage`, {
            method: "POST",
            body: { action: "end" }
          });

          if (activeSessionId === sessionId) {
            setActiveSession(null);
            setMessages([]);
          }

          setActiveSessions((previous) => previous.filter((sessionRow) => sessionRow.session_id !== sessionId));
          setActionAlert("sessionManage", "success", "Session ended.");
        } catch (requestError) {
          setActionAlert(
            "sessionManage",
            "error",
            requestError instanceof Error ? requestError.message : "We couldn't end that session. Please try again."
          );
        } finally {
          setLoadingState("sessionManage", false);
        }
      },
      [activeSessionId, clearActionAlert, parentRequest, setActionAlert, setActiveSession, setActiveSessions, setError, setLoadingState, setMessages]
    );

    const regenerateCode = useCallback(
      async (sessionId) => {
        setLoadingState("sessionManage", true);
        setError("");
        clearActionAlert("sessionManage");

        try {
          const result = await parentRequest(`/api/session/${sessionId}/manage`, {
            method: "POST",
            body: { action: "regenerate_code" }
          });

          if (result?.join_code) {
            setActiveSession((previous) => {
              if (!previous || previous.session_id !== sessionId) {
                return previous;
              }

              return buildSessionForUi(
                {
                  ...previous,
                  join_code: result.join_code,
                  expires_at: result.expires_at
                },
                children,
                previous
              );
            });

            setActiveSessions((previous) =>
              previous.map((sessionRow) => {
                if (sessionRow.session_id !== sessionId) {
                  return sessionRow;
                }

                return buildSessionForUi(
                  {
                    ...sessionRow,
                    join_code: result.join_code,
                    expires_at: result.expires_at
                  },
                  children,
                  sessionRow
                );
              })
            );
            setActionAlert("sessionManage", "success", "Join code refreshed.");
          }

          return result;
        } catch (requestError) {
          setActionAlert(
            "sessionManage",
            "error",
            requestError instanceof Error ? requestError.message : "We couldn't regenerate the join code. Please try again."
          );
          return null;
        } finally {
          setLoadingState("sessionManage", false);
        }
      },
      [children, clearActionAlert, parentRequest, setActionAlert, setActiveSession, setActiveSessions, setError, setLoadingState]
    );

    return {
      startSession,
      rejoinSession,
      endSession,
      regenerateCode
    };
  };
}

export const useParentSessions = createUseParentSessions();
