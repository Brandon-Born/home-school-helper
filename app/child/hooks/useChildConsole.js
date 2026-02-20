"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isChildAuthFailure } from "../../../src/lib/auth-failures.js";
import { apiRequest } from "../../../src/lib/http.js";
import { trackProductEvent } from "../../../src/lib/product-analytics.js";
import { useSessionStream } from "../../hooks/useSessionStream.js";
import { useChildVoiceRuntime } from "./useChildVoiceRuntime.js";

const STORAGE_KEY = "child_session_access";

export function mergeMessages(previous, incoming) {
  const map = new Map(previous.map((message) => [message.id, message]));
  for (const message of incoming) {
    map.set(message.id, message);
  }

  return Array.from(map.values()).sort(
    (left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
  );
}

export function createUseChildConsole({
  apiRequestImpl = apiRequest,
  useSessionStreamHook = useSessionStream,
  useChildVoiceRuntimeHook = useChildVoiceRuntime,
  trackProductEventImpl = trackProductEvent
} = {}) {
  return function useChildConsole() {
  const [sessionAccess, setSessionAccess] = useState(null);
  const [joinCode, setJoinCodeState] = useState("");
  const [deviceFingerprint, setDeviceFingerprint] = useState("");
  const [studentInput, setStudentInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState({
    join: false,
    send: false
  });
  const [error, setError] = useState("");
  const [isHoldToTalkPressed, setIsHoldToTalkPressed] = useState(false);
  const clearSessionRef = useRef((message) => {
    void message;
  });

  const setLoadingState = useCallback((key, value) => {
    setLoading((previous) => ({
      ...previous,
      [key]: value
    }));
  }, []);

  const setJoinCode = useCallback((value) => {
    setJoinCodeState(String(value ?? "").toUpperCase());
  }, []);

  const handleSessionInvalid = useCallback((message) => {
    clearSessionRef.current(message);
  }, []);

  const voice = useChildVoiceRuntimeHook({
    sessionAccess,
    studentInput,
    setStudentInput,
    setError,
    onSessionInvalid: handleSessionInvalid
  });
  const voiceActionsRef = useRef(voice.actions);
  const voiceStreamRef = useRef(voice.stream);

  useEffect(() => {
    voiceActionsRef.current = voice.actions;
    voiceStreamRef.current = voice.stream;
  }, [voice.actions, voice.stream]);

  const clearChildSession = useCallback((message) => {
    voiceActionsRef.current.resetVoiceRuntime();

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }

    setSessionAccess(null);
    setMessages([]);
    setLoading({
      join: false,
      send: false
    });
    setIsHoldToTalkPressed(false);
    setStudentInput("");
    setError(message || "");
  }, []);

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

  const handleStreamSnapshot = useCallback(
    (incoming) => {
      setMessages(incoming);
      setError("");
      voiceStreamRef.current.initializeFromSnapshot(incoming);
    },
    []
  );

  const handleStreamAppend = useCallback(
    (incoming) => {
      if (incoming.some((message) => message.actor_type === "assistant")) {
        voiceActionsRef.current.setPendingTutorReply(false);
      }
      setMessages((previous) => mergeMessages(previous, incoming));
      voiceStreamRef.current.handleIncomingMessages(incoming);
    },
    []
  );

  const handleStreamDisconnect = useCallback((streamError) => {
    if (isChildAuthFailure(streamError)) {
      clearSessionRef.current("Your lesson code expired. Please ask your parent for a new code.");
      return "stop";
    }

    setError(streamError instanceof Error ? streamError.message : "Connection lost. Reconnecting...");
    return "reconnect";
  }, []);

  const handleStreamError = useCallback((message) => {
    setError(message || "We lost connection for a moment.");
  }, []);

  useSessionStreamHook({
    sessionId: sessionAccess?.session_id ?? null,
    accessToken: sessionAccess?.child_session_token ?? null,
    onSnapshot: handleStreamSnapshot,
    onAppend: handleStreamAppend,
    onStreamError: handleStreamError,
    onDisconnect: handleStreamDisconnect
  });

  async function joinSession(event) {
    event.preventDefault();
    setLoadingState("join", true);
    setError("");
    voiceActionsRef.current.setPendingTutorReply(false);

    try {
      const payload = await apiRequestImpl("/api/session/join", {
        method: "POST",
        body: {
          code: joinCode,
          device_fingerprint: deviceFingerprint || null
        }
      });

      const access = payload.session_access;
      setSessionAccess(access);
      voiceStreamRef.current.initializeFromSnapshot([]);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(access));
      setJoinCodeState("");
      trackProductEventImpl("child_join", {
        status: "success"
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "We couldn't join that lesson. Check the code and try again.");
      trackProductEventImpl("child_join", {
        status: "failed"
      });
    } finally {
      setLoadingState("join", false);
    }
  }

  async function sendTurn(event) {
    event.preventDefault();
    if (!sessionAccess?.session_id || !studentInput.trim()) {
      return;
    }

    setLoadingState("send", true);
    setError("");
    voiceActionsRef.current.setPendingTutorReply(true);

    try {
      const payload = await apiRequestImpl(`/api/session/${sessionAccess.session_id}/child-turn`, {
        method: "POST",
        bearerToken: sessionAccess.child_session_token,
        body: {
          student_input: studentInput.trim()
        }
      });

      const freshMessages = [];
      if (payload?.input_message) {
        freshMessages.push(payload.input_message);
      }
      if (payload?.assistant_message) {
        freshMessages.push(payload.assistant_message);
      }

      if (freshMessages.length > 0) {
        setMessages((previous) => mergeMessages(previous, freshMessages));
      }

      if (payload?.assistant_message) {
        voiceActionsRef.current.setPendingTutorReply(false);
        voiceStreamRef.current.handleIncomingMessages([payload.assistant_message]);
      }

      setStudentInput("");
      trackProductEventImpl("turn_send", {
        status: "success"
      });
    } catch (requestError) {
      if (isChildAuthFailure(requestError)) {
        clearChildSession("Your lesson code expired. Please ask your parent for a new code.");
        trackProductEventImpl("turn_send", {
          status: "failed"
        });
        return;
      }

      setError(requestError instanceof Error ? requestError.message : "We couldn't send your question. Please try again.");
      voiceActionsRef.current.setPendingTutorReply(false);
      trackProductEventImpl("turn_send", {
        status: "failed"
      });
    } finally {
      setLoadingState("send", false);
    }
  }

  function leaveSession() {
    clearChildSession("");
  }

  const beginHoldToTalk = useCallback(() => {
    setIsHoldToTalkPressed(true);
  }, []);

  const endHoldToTalk = useCallback(() => {
    setIsHoldToTalkPressed(false);
  }, []);

    return {
    state: {
      sessionAccess,
      joinCode,
      deviceFingerprint,
      studentInput,
      messages,
      loading,
      joinLoading: loading.join,
      sendLoading: loading.send,
      error,
      voiceBusy: voice.state.voiceBusy,
      isTranscribing: voice.state.isTranscribing,
      isPlayingSpeech: voice.state.isPlayingSpeech,
      pendingTutorReply: voice.state.pendingTutorReply,
      turnStatus: voice.state.turnStatus,
      speechSupport: voice.state.speechSupport,
      isListening: voice.state.isListening,
      isCloudRecording: voice.state.isCloudRecording,
      isHoldToTalkPressed,
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
      beginHoldToTalk,
      endHoldToTalk,
      startVoiceCapture: voice.actions.startVoiceCapture,
      stopVoiceCapture: voice.actions.stopVoiceCapture,
      leaveSession
    }
    };
  };
}

export const useChildConsole = createUseChildConsole();
