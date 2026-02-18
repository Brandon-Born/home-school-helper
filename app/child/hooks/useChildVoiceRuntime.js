"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { initializeSpokenAssistantMessageIds, takeFreshAssistantMessages } from "./voice/assistant-messages.js";
import { useChildVoiceCapture } from "./voice/useChildVoiceCapture.js";
import { getListeningLabelText, getTurnStatusText, getVoiceStatusText } from "./voice/speech-status.js";
import { useVoicePlayback } from "./voice/useVoicePlayback.js";

export function useChildVoiceRuntime({
  sessionAccess,
  studentInput,
  setStudentInput,
  setError,
  onSessionInvalid
}) {
  const [isPlayingSpeech, setIsPlayingSpeech] = useState(false);
  const [pendingTutorReply, setPendingTutorReply] = useState(false);
  const [notice, setNotice] = useState("");
  const [autoSpeak, setAutoSpeak] = useState(true);

  const spokenAssistantMessageIdsRef = useRef(new Set());
  const autoSpeakRef = useRef(autoSpeak);
  const speechSupportRef = useRef({
    cloudStt: false,
    browserStt: false,
    cloudTts: false,
    browserTts: false
  });

  const voicePlayback = useVoicePlayback({
    sessionAccess,
    speechSupportRef,
    setIsPlayingSpeech,
    setNotice,
    onSessionInvalid
  });

  const capture = useChildVoiceCapture({
    sessionAccess,
    studentInput,
    setStudentInput,
    setError,
    setNotice,
    onSessionInvalid,
    isPlayingSpeech,
    speechSupportRef
  });

  const voiceBusy = capture.state.isTranscribing || isPlayingSpeech;
  const voiceStatus = useMemo(() => getVoiceStatusText(capture.state.speechSupport), [capture.state.speechSupport]);

  function resetVoiceRuntime() {
    capture.actions.stopAllVoiceCapture();
    voicePlayback.resetPlayback();
    spokenAssistantMessageIdsRef.current = new Set();

    setIsPlayingSpeech(false);
    setPendingTutorReply(false);
    setNotice("");
  }

  function initializeFromSnapshot(messages = []) {
    spokenAssistantMessageIdsRef.current = initializeSpokenAssistantMessageIds(messages);
  }

  function handleIncomingMessages(incoming = []) {
    if (!autoSpeakRef.current) {
      return;
    }

    const freshAssistantMessages = takeFreshAssistantMessages(incoming, spokenAssistantMessageIdsRef.current);
    const latest = freshAssistantMessages[freshAssistantMessages.length - 1];
    if (!latest) {
      return;
    }

    setPendingTutorReply(false);
    setNotice("");

    void (async () => {
      await voicePlayback.playAssistantText(latest.content);
    })();
  }

  const startVoiceCapture = capture.actions.startVoiceCapture;
  const stopVoiceCapture = capture.actions.stopVoiceCapture;

  useEffect(() => {
    autoSpeakRef.current = autoSpeak;
  }, [autoSpeak]);

  useEffect(() => {
    return () => {
      voicePlayback.resetPlayback();
    };
  }, [voicePlayback.resetPlayback]);

  const turnStatus = useMemo(() => {
    return getTurnStatusText({
      isCloudRecording: capture.state.isCloudRecording,
      isListening: capture.state.isListening,
      isTranscribing: capture.state.isTranscribing,
      pendingTutorReply,
      isPlayingSpeech,
      notice
    });
  }, [capture.state.isCloudRecording, capture.state.isListening, capture.state.isTranscribing, pendingTutorReply, isPlayingSpeech, notice]);

  const listeningLabel = useMemo(() => {
    return getListeningLabelText({
      isCloudRecording: capture.state.isCloudRecording,
      isListening: capture.state.isListening,
      isTranscribing: capture.state.isTranscribing,
      isPlayingSpeech
    });
  }, [capture.state.isCloudRecording, capture.state.isListening, capture.state.isTranscribing, isPlayingSpeech]);

  return {
    state: {
      voiceBusy,
      isTranscribing: capture.state.isTranscribing,
      isPlayingSpeech,
      pendingTutorReply,
      turnStatus,
      speechSupport: capture.state.speechSupport,
      isListening: capture.state.isListening,
      isCloudRecording: capture.state.isCloudRecording,
      autoSpeak,
      voiceStatus,
      listeningLabel
    },
    actions: {
      setAutoSpeak,
      startVoiceCapture,
      stopVoiceCapture,
      setPendingTutorReply,
      resetVoiceRuntime
    },
    stream: {
      initializeFromSnapshot,
      handleIncomingMessages
    }
  };
}
