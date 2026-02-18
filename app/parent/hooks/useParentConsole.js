"use client";

import { useCallback, useEffect, useState } from "react";
import { useParentSession } from "./useParentSession.js";
import { useParentTranscriptStream } from "./useParentTranscriptStream.js";

function toList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function mergeMessages(previous, incoming) {
  const map = new Map(previous.map((message) => [message.id, message]));
  for (const message of incoming) {
    map.set(message.id, message);
  }

  return Array.from(map.values()).sort(
    (left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
  );
}

export function buildSessionForUi(sessionData, children = [], previousSession = null) {
  if (!sessionData) {
    return null;
  }

  const childNameFromList = children.find((child) => child.id === sessionData.child_id)?.first_name;
  const startedAt = sessionData.started_at ?? previousSession?.started_at ?? new Date().toISOString();

  return {
    ...previousSession,
    ...sessionData,
    child_name: sessionData.child_name ?? childNameFromList ?? previousSession?.child_name ?? "Unknown",
    started_at: startedAt
  };
}

const initialChildForm = {
  child_name: "",
  age: "",
  grade: "",
  subjects: "",
  personality_description: "",
  special_needs: ""
};

const initialSessionForm = {
  daily_subjects: "",
  parent_context: "",
  goal_notes: "",
  additional_context: ""
};

const initialLoadingState = {
  auth: false,
  refreshParentData: false,
  childMutation: false,
  sessionStart: false,
  nudge: false,
  override: false,
  sessionManage: false
};

export function createUseParentConsole({
  useParentSessionHook = useParentSession,
  useParentTranscriptStreamHook = useParentTranscriptStream
} = {}) {
  return function useParentConsole() {
  const [parentProfile, setParentProfile] = useState(null);
  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState("");
  const [activeSession, setActiveSession] = useState(null);
  const [activeSessions, setActiveSessions] = useState([]);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(initialLoadingState);
  const [nudgeResponse, setNudgeResponse] = useState("");
  const [childForm, setChildForm] = useState(initialChildForm);
  const [sessionForm, setSessionForm] = useState(initialSessionForm);
  const [nudgeText, setNudgeText] = useState("");

  const setLoadingState = useCallback((key, value) => {
    setLoading((previous) => ({
      ...previous,
      [key]: value
    }));
  }, []);

  const clearParentData = useCallback(() => {
    setParentProfile(null);
    setChildren([]);
    setSelectedChildId("");
    setActiveSession(null);
    setActiveSessions([]);
    setMessages([]);
    setNudgeResponse("");
    setLoading(initialLoadingState);
  }, []);

  const {
    session,
    needsReauth,
    parentRequest,
    refreshParentSession,
    invalidateParentSession,
    signInWithGoogle,
    signOut
  } = useParentSessionHook({
    onSessionCleared: clearParentData,
    setError
  });

  const fetchParentData = useCallback(async () => {
    if (!session?.access_token) {
      return;
    }

    setLoadingState("refreshParentData", true);
    setError("");

    try {
      const [profilePayload, childrenPayload, sessionsPayload] = await Promise.all([
        parentRequest("/api/parent/me"),
        parentRequest("/api/children"),
        parentRequest("/api/session/active")
      ]);

      setParentProfile(profilePayload.parent);
      const nextChildren = childrenPayload.children ?? [];
      setChildren(nextChildren);
      const nextActiveSessions = sessionsPayload.sessions ?? [];
      setActiveSessions(nextActiveSessions);

      setSelectedChildId((previous) => {
        if (previous && nextChildren.some((child) => child.id === previous)) {
          return previous;
        }
        return nextChildren[0]?.id ?? "";
      });

      setActiveSession((previous) => {
        if (!previous) {
          return previous;
        }

        const matching = nextActiveSessions.find((sessionRow) => sessionRow.session_id === previous.session_id);
        if (!matching) {
          return null;
        }

        return buildSessionForUi(matching, nextChildren, previous);
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "We couldn't load your parent data. Please try again.");
    } finally {
      setLoadingState("refreshParentData", false);
    }
  }, [parentRequest, session?.access_token, setLoadingState]);

  useEffect(() => {
    fetchParentData();
  }, [fetchParentData]);

  const handleStreamSnapshot = useCallback((snapshotMessages) => {
    setMessages(snapshotMessages);
  }, []);

  const handleStreamAppend = useCallback((incomingMessages) => {
    setMessages((previous) => mergeMessages(previous, incomingMessages));
  }, []);

  useParentTranscriptStreamHook({
    activeSessionId: activeSession?.session_id ?? null,
    accessToken: session?.access_token ?? null,
    refreshParentSession,
    invalidateParentSession,
    onSnapshot: handleStreamSnapshot,
    onAppend: handleStreamAppend,
    setError
  });

  const signIn = useCallback(async () => {
    setLoadingState("auth", true);
    try {
      await signInWithGoogle();
    } finally {
      setLoadingState("auth", false);
    }
  }, [setLoadingState, signInWithGoogle]);

  const signOutAction = useCallback(async () => {
    setLoadingState("auth", true);
    try {
      await signOut();
    } finally {
      setLoadingState("auth", false);
    }
  }, [setLoadingState, signOut]);

  const createChild = useCallback(
    async (event) => {
      event.preventDefault();
      setLoadingState("childMutation", true);
      setError("");

      try {
        await parentRequest("/api/children", {
          method: "POST",
          body: {
            ...childForm,
            age: Number.parseInt(childForm.age, 10),
            subjects: toList(childForm.subjects)
          }
        });

        setChildForm(initialChildForm);
        await fetchParentData();
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "We couldn't save that child profile. Please try again.");
      } finally {
        setLoadingState("childMutation", false);
      }
    },
    [childForm, fetchParentData, parentRequest, setLoadingState]
  );

  const updateChild = useCallback(
    async (childId, updatedForm) => {
      setLoadingState("childMutation", true);
      setError("");

      try {
        await parentRequest(`/api/children/${childId}`, {
          method: "PUT",
          body: {
            ...updatedForm,
            age: Number.parseInt(updatedForm.age, 10),
            subjects: toList(updatedForm.subjects)
          }
        });

        await fetchParentData();
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "We couldn't update that child profile. Please try again.");
      } finally {
        setLoadingState("childMutation", false);
      }
    },
    [fetchParentData, parentRequest, setLoadingState]
  );

  const deleteChild = useCallback(
    async (childId) => {
      setLoadingState("childMutation", true);
      setError("");

      try {
        await parentRequest(`/api/children/${childId}`, {
          method: "DELETE"
        });

        if (selectedChildId === childId) {
          setSelectedChildId("");
        }

        await fetchParentData();
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "We couldn't delete that child profile. Please try again.");
      } finally {
        setLoadingState("childMutation", false);
      }
    },
    [fetchParentData, parentRequest, selectedChildId, setLoadingState]
  );

  const startSession = useCallback(
    async (event) => {
      event.preventDefault();
      setLoadingState("sessionStart", true);
      setError("");

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
        setNudgeResponse("");
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "We couldn't start the session. Please try again.");
      } finally {
        setLoadingState("sessionStart", false);
      }
    },
    [children, parentRequest, selectedChildId, sessionForm, setLoadingState]
  );

  const sendNudge = useCallback(
    async (event) => {
      event.preventDefault();
      if (!activeSession?.session_id || !nudgeText.trim()) {
        return;
      }

      setLoadingState("nudge", true);
      setError("");

      try {
        const payload = await parentRequest(`/api/session/${activeSession.session_id}/parent-nudge`, {
          method: "POST",
          body: {
            nudge_text: nudgeText.trim(),
            parent_guidance: nudgeText.trim()
          }
        });

        setNudgeResponse(payload.assistant_text || "Nudge sent.");
        setNudgeText("");
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "We couldn't send that private note. Please try again.");
      } finally {
        setLoadingState("nudge", false);
      }
    },
    [activeSession?.session_id, nudgeText, parentRequest, setLoadingState]
  );

  const setOverride = useCallback(
    async (enabled) => {
      if (!activeSession?.session_id) {
        return;
      }

      setLoadingState("override", true);
      setError("");

      try {
        await parentRequest(`/api/session/${activeSession.session_id}/override`, {
          method: "POST",
          body: {
            enabled,
            duration_minutes: 15
          }
        });
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "We couldn't update direct-answer mode. Please try again.");
      } finally {
        setLoadingState("override", false);
      }
    },
    [activeSession?.session_id, parentRequest, setLoadingState]
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
      setNudgeResponse("");
    },
    [children]
  );

  const endSession = useCallback(
    async (sessionId) => {
      setLoadingState("sessionManage", true);
      setError("");

      try {
        await parentRequest(`/api/session/${sessionId}/manage`, {
          method: "POST",
          body: { action: "end" }
        });

        if (activeSession?.session_id === sessionId) {
          setActiveSession(null);
          setMessages([]);
          setNudgeResponse("");
        }

        setActiveSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "We couldn't end that session. Please try again.");
      } finally {
        setLoadingState("sessionManage", false);
      }
    },
    [activeSession?.session_id, parentRequest, setLoadingState]
  );

  const regenerateCode = useCallback(
    async (sessionId) => {
      setLoadingState("sessionManage", true);
      setError("");

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
        }

        return result;
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "We couldn't regenerate the join code. Please try again.");
        return null;
      } finally {
        setLoadingState("sessionManage", false);
      }
    },
    [children, parentRequest, setLoadingState]
  );

    return {
    state: {
      session,
      needsReauth,
      parentProfile,
      children,
      selectedChildId,
      activeSession,
      activeSessions,
      messages,
      error,
      loading,
      busy: Object.values(loading).some(Boolean),
      nudgeResponse,
      childForm,
      sessionForm,
      nudgeText
    },
    actions: {
      signInWithGoogle: signIn,
      signOut: signOutAction,
      createChild,
      updateChild,
      deleteChild,
      startSession,
      rejoinSession,
      endSession,
      regenerateCode,
      sendNudge,
      setOverride,
      refreshParentData: fetchParentData,
      setSelectedChildId,
      setChildForm,
      setSessionForm,
      setNudgeText,
      setError
    }
    };
  };
}

export const useParentConsole = createUseParentConsole();
