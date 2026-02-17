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

function mergeMessages(previous, incoming) {
  const map = new Map(previous.map((message) => [message.id, message]));
  for (const message of incoming) {
    map.set(message.id, message);
  }

  return Array.from(map.values()).sort(
    (left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
  );
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

export function useParentConsole() {
  const [parentProfile, setParentProfile] = useState(null);
  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState("");
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [nudgeResponse, setNudgeResponse] = useState("");
  const [childForm, setChildForm] = useState(initialChildForm);
  const [sessionForm, setSessionForm] = useState(initialSessionForm);
  const [nudgeText, setNudgeText] = useState("");

  const clearParentData = useCallback(() => {
    setParentProfile(null);
    setChildren([]);
    setSelectedChildId("");
    setActiveSession(null);
    setMessages([]);
    setNudgeResponse("");
  }, []);

  const {
    session,
    needsReauth,
    parentRequest,
    refreshParentSession,
    invalidateParentSession,
    signInWithGoogle,
    signOut
  } = useParentSession({
    onSessionCleared: clearParentData,
    setError
  });

  const fetchParentData = useCallback(async () => {
    if (!session?.access_token) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const profilePayload = await parentRequest("/api/parent/me");
      const childrenPayload = await parentRequest("/api/children");

      setParentProfile(profilePayload.parent);
      setChildren(childrenPayload.children ?? []);

      if (!selectedChildId && childrenPayload.children?.length > 0) {
        setSelectedChildId(childrenPayload.children[0].id);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "We couldn't load your parent data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [parentRequest, selectedChildId, session?.access_token]);

  useEffect(() => {
    fetchParentData();
  }, [fetchParentData]);

  const handleStreamSnapshot = useCallback((snapshotMessages) => {
    setMessages(snapshotMessages);
  }, []);

  const handleStreamAppend = useCallback((incomingMessages) => {
    setMessages((previous) => mergeMessages(previous, incomingMessages));
  }, []);

  useParentTranscriptStream({
    activeSessionId: activeSession?.session_id ?? null,
    accessToken: session?.access_token ?? null,
    refreshParentSession,
    invalidateParentSession,
    onSnapshot: handleStreamSnapshot,
    onAppend: handleStreamAppend,
    setError
  });

  const createChild = useCallback(
    async (event) => {
      event.preventDefault();
      setLoading(true);
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
        setLoading(false);
      }
    },
    [childForm, fetchParentData, parentRequest]
  );

  const startSession = useCallback(
    async (event) => {
      event.preventDefault();
      setLoading(true);
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

        setActiveSession(payload.session);
        setMessages([]);
        setNudgeResponse("");
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "We couldn't start the session. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [parentRequest, selectedChildId, sessionForm]
  );

  const sendNudge = useCallback(
    async (event) => {
      event.preventDefault();
      if (!activeSession?.session_id || !nudgeText.trim()) {
        return;
      }

      setLoading(true);
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
        setLoading(false);
      }
    },
    [activeSession?.session_id, nudgeText, parentRequest]
  );

  const setOverride = useCallback(
    async (enabled) => {
      if (!activeSession?.session_id) {
        return;
      }

      setLoading(true);
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
        setLoading(false);
      }
    },
    [activeSession?.session_id, parentRequest]
  );

  return {
    state: {
      session,
      needsReauth,
      parentProfile,
      children,
      selectedChildId,
      activeSession,
      messages,
      error,
      loading,
      nudgeResponse,
      childForm,
      sessionForm,
      nudgeText
    },
    actions: {
      signInWithGoogle,
      signOut,
      createChild,
      startSession,
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
}
