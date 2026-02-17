"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../../src/lib/http.js";
import { openEventStream } from "../../../src/lib/event-stream.js";
import { getBrowserSupabaseClient } from "../../../src/lib/supabase-browser.js";

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
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);

  const [session, setSession] = useState(null);
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

  const parentRequest = useCallback(
    async (path, options = {}) => {
      if (!session?.access_token) {
        throw new Error("Parent session is not available.");
      }

      return apiRequest(path, {
        ...options,
        bearerToken: session.access_token
      });
    },
    [session?.access_token]
  );

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
      setError(requestError instanceof Error ? requestError.message : "Failed to load parent data.");
    } finally {
      setLoading(false);
    }
  }, [parentRequest, selectedChildId, session?.access_token]);

  useEffect(() => {
    async function loadInitialSession() {
      const {
        data: { session: currentSession }
      } = await supabase.auth.getSession();
      setSession(currentSession ?? null);
    }

    loadInitialSession();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    fetchParentData();
  }, [fetchParentData]);

  useEffect(() => {
    if (!activeSession?.session_id || !session?.access_token) {
      return;
    }

    let disposed = false;
    let reconnectTimer;
    let streamAbortController;

    const connect = async () => {
      streamAbortController = new AbortController();

      try {
        await openEventStream({
          path: `/api/session/${activeSession.session_id}/stream?limit=200`,
          bearerToken: session.access_token,
          signal: streamAbortController.signal,
          onEvent: ({ event, data }) => {
            if (disposed) {
              return;
            }

            if (event === "snapshot") {
              setMessages(data.messages ?? []);
              return;
            }

            if (event === "message_append") {
              setMessages((previous) => mergeMessages(previous, data.messages ?? []));
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
  }, [activeSession?.session_id, session?.access_token]);

  const signInWithGoogle = useCallback(async () => {
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo
      }
    });

    if (signInError) {
      setError(signInError.message);
    }
  }, [supabase]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setParentProfile(null);
    setChildren([]);
    setActiveSession(null);
    setMessages([]);
  }, [supabase]);

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
        setError(requestError instanceof Error ? requestError.message : "Unable to create child profile.");
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
        setError(requestError instanceof Error ? requestError.message : "Unable to start session.");
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
        setError(requestError instanceof Error ? requestError.message : "Unable to send nudge.");
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
        setError(requestError instanceof Error ? requestError.message : "Unable to update override.");
      } finally {
        setLoading(false);
      }
    },
    [activeSession?.session_id, parentRequest]
  );

  return {
    state: {
      session,
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
