"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { openEventStream } from "../../../src/lib/event-stream.js";
import { isChildAuthFailure } from "../../../src/lib/auth-failures.js";
import { apiRequest } from "../../../src/lib/http.js";
import { useChildVoiceRuntime } from "./useChildVoiceRuntime.js";

const STORAGE_KEY = "child_session_access";

function mergeMessages(previous, incoming) {
  const map = new Map(previous.map((message) => [message.id, message]));
  for (const message of incoming) {
    map.set(message.id, message);
  }

  return Array.from(map.values()).sort(
    (left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
  );
}

export function useChildConsole() {
  const [sessionAccess, setSessionAccess] = useState(null);
  const [joinCode, setJoinCode] = useState("");
  const [deviceFingerprint, setDeviceFingerprint] = useState("");
  const [studentInput, setStudentInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const clearSessionRef = useRef((message) => {
    void message;
  });

  const handleSessionInvalid = useCallback((message) => {
    clearSessionRef.current(message);
  }, []);

  const voice = useChildVoiceRuntime({
    sessionAccess,
    studentInput,
    setStudentInput,
    setError,
    onSessionInvalid: handleSessionInvalid
  });

  const clearChildSession = useCallback((message) => {
    voice.actions.resetVoiceRuntime();

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }

    setSessionAccess(null);
    setMessages([]);
    setLoading(false);
    setStudentInput("");
    setError(message || "");
  }, [voice.actions]);

  clearSessionRef.current = clearChildSession;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw);
      if (parsed?.session_id && parsed?.child_session_token) {
        setSessionAccess(parsed);
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!sessionAccess?.session_id || !sessionAccess?.child_session_token) {
      return;
    }

    let disposed = false;
    let reconnectTimer;
    let streamAbortController;

    const connect = async () => {
      streamAbortController = new AbortController();

      try {
        await openEventStream({
          path: `/api/session/${sessionAccess.session_id}/stream?limit=200`,
          bearerToken: sessionAccess.child_session_token,
          signal: streamAbortController.signal,
          onEvent: ({ event, data }) => {
            if (disposed) {
              return;
            }

            if (event === "snapshot") {
              const incoming = data.messages ?? [];
              setMessages(incoming);
              setError("");
              voice.stream.initializeFromSnapshot(incoming);
              return;
            }

            if (event === "message_append") {
              const incoming = data.messages ?? [];
              if (incoming.some((message) => message.actor_type === "assistant")) {
                voice.actions.setPendingTutorReply(false);
              }
              setMessages((previous) => mergeMessages(previous, incoming));
              voice.stream.handleIncomingMessages(incoming);
              return;
            }

            if (event === "error") {
              setError(data?.message || "We lost connection for a moment.");
            }
          }
        });
      } catch (streamError) {
        if (disposed) {
          return;
        }

        if (isChildAuthFailure(streamError)) {
          clearSessionRef.current("Your lesson code expired. Please ask your parent for a new code.");
          return;
        }

        setError(streamError instanceof Error ? streamError.message : "Connection lost. Reconnecting...");
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
    sessionAccess?.child_session_token,
    sessionAccess?.session_id
  ]);

  async function joinSession(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    voice.actions.setPendingTutorReply(false);

    try {
      const payload = await apiRequest("/api/session/join", {
        method: "POST",
        body: {
          code: joinCode,
          device_fingerprint: deviceFingerprint || null
        }
      });

      const access = payload.session_access;
      setSessionAccess(access);
      voice.stream.initializeFromSnapshot([]);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(access));
      setJoinCode("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "We couldn't join that lesson. Check the code and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function sendTurn(event) {
    event.preventDefault();
    if (!sessionAccess?.session_id || !studentInput.trim()) {
      return;
    }

    setLoading(true);
    setError("");
    voice.actions.setPendingTutorReply(true);

    try {
      await apiRequest(`/api/session/${sessionAccess.session_id}/child-turn`, {
        method: "POST",
        bearerToken: sessionAccess.child_session_token,
        body: {
          student_input: studentInput.trim()
        }
      });

      setStudentInput("");
    } catch (requestError) {
      if (isChildAuthFailure(requestError)) {
        clearChildSession("Your lesson code expired. Please ask your parent for a new code.");
        return;
      }

      setError(requestError instanceof Error ? requestError.message : "We couldn't send your question. Please try again.");
      voice.actions.setPendingTutorReply(false);
    } finally {
      setLoading(false);
    }
  }

  function leaveSession() {
    clearChildSession("");
  }

  return {
    state: {
      sessionAccess,
      joinCode,
      deviceFingerprint,
      studentInput,
      messages,
      loading,
      error,
      voiceBusy: voice.state.voiceBusy,
      isTranscribing: voice.state.isTranscribing,
      isPlayingSpeech: voice.state.isPlayingSpeech,
      pendingTutorReply: voice.state.pendingTutorReply,
      turnStatus: voice.state.turnStatus,
      speechSupport: voice.state.speechSupport,
      isListening: voice.state.isListening,
      isCloudRecording: voice.state.isCloudRecording,
      autoSpeak: voice.state.autoSpeak,
      voiceStatus: voice.state.voiceStatus,
      listeningLabel: voice.state.listeningLabel
    },
    actions: {
      setJoinCode,
      setDeviceFingerprint,
      setStudentInput,
      setAutoSpeak: voice.actions.setAutoSpeak,
      joinSession,
      sendTurn,
      startVoiceCapture: voice.actions.startVoiceCapture,
      stopVoiceCapture: voice.actions.stopVoiceCapture,
      leaveSession
    }
  };
}
