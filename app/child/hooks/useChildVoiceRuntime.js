"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { isChildAuthFailure } from "../../../src/lib/auth-failures.js";
import { ApiRequestError, apiFormRequest } from "../../../src/lib/http.js";

function getSpeechRecognitionCtor() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function getCloudSttSupport() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  return Boolean(window.MediaRecorder && navigator.mediaDevices?.getUserMedia);
}

function classifySpeechFailure(error, fallbackMessage) {
  if (error instanceof ApiRequestError) {
    if (error.status === 429 || error.code === "speech_provider_rate_limited") {
      return "Voice service is busy. Try again in a few seconds or type your question.";
    }

    if (error.code === "speech_provider_timeout") {
      return "Voice service timed out. Try again, or type your question.";
    }

    if (error.status >= 500 || error.code === "speech_provider_unavailable") {
      return "Voice service is temporarily unavailable. You can keep going in text mode.";
    }
  }

  const message = error instanceof Error ? error.message : "";
  if (/timeout|timed out/i.test(message)) {
    return "Voice service timed out. Try again, or type your question.";
  }

  return fallbackMessage;
}

export function useChildVoiceRuntime({
  sessionAccess,
  studentInput,
  setStudentInput,
  setError,
  onSessionInvalid
}) {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isPlayingSpeech, setIsPlayingSpeech] = useState(false);
  const [pendingTutorReply, setPendingTutorReply] = useState(false);
  const [notice, setNotice] = useState("");
  const [speechSupport, setSpeechSupport] = useState({
    cloudStt: false,
    browserStt: false,
    cloudTts: false,
    browserTts: false
  });
  const [isListening, setIsListening] = useState(false);
  const [isCloudRecording, setIsCloudRecording] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);

  const recognitionRef = useRef(null);
  const voiceBaseInputRef = useRef("");
  const voiceFinalTranscriptRef = useRef("");
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const playbackAudioRef = useRef(null);
  const playbackUrlRef = useRef(null);
  const spokenAssistantMessageIdsRef = useRef(new Set());
  const autoSpeakRef = useRef(autoSpeak);
  const speechSupportRef = useRef(speechSupport);
  const studentInputRef = useRef(studentInput);

  const voiceBusy = isTranscribing || isPlayingSpeech;

  const voiceStatus = useMemo(() => {
    if (speechSupport.cloudStt && speechSupport.cloudTts) {
      return "Cloud speech active: Google STT V2 + Chirp 3 TTS.";
    }

    if (speechSupport.cloudStt) {
      return "Cloud STT active. Tutor audio uses browser fallback.";
    }

    if (speechSupport.browserStt && speechSupport.browserTts) {
      return "Browser voice fallback active.";
    }

    if (speechSupport.browserStt) {
      return "Browser voice input fallback active.";
    }

    if (speechSupport.browserTts) {
      return "Browser audio playback fallback active.";
    }

    return "Voice unavailable in this browser. Text mode only.";
  }, [speechSupport]);

  function revokePlaybackResources() {
    if (playbackAudioRef.current) {
      playbackAudioRef.current.pause();
      playbackAudioRef.current = null;
    }

    if (playbackUrlRef.current) {
      URL.revokeObjectURL(playbackUrlRef.current);
      playbackUrlRef.current = null;
    }

    setIsPlayingSpeech(false);
  }

  function stopBrowserVoiceCapture() {
    const recognition = recognitionRef.current;
    if (!recognition) {
      return;
    }

    recognitionRef.current = null;
    try {
      recognition.stop();
    } catch {
      // Ignore redundant stop calls.
    }
  }

  function stopCloudVoiceCapture() {
    const recorder = mediaRecorderRef.current;
    if (!recorder) {
      return;
    }

    mediaRecorderRef.current = null;
    try {
      if (recorder.state !== "inactive") {
        recorder.stop();
      }
    } catch {
      // Ignore redundant stop calls.
    }
  }

  function stopAllVoiceCapture() {
    stopBrowserVoiceCapture();
    stopCloudVoiceCapture();

    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) {
        track.stop();
      }
      mediaStreamRef.current = null;
    }

    setIsListening(false);
    setIsCloudRecording(false);
  }

  function resetVoiceRuntime() {
    stopAllVoiceCapture();
    revokePlaybackResources();
    spokenAssistantMessageIdsRef.current = new Set();

    if (typeof window !== "undefined") {
      window.speechSynthesis?.cancel();
    }

    setIsTranscribing(false);
    setIsPlayingSpeech(false);
    setPendingTutorReply(false);
    setNotice("");
  }

  function speakTextFallback(text) {
    if (!speechSupportRef.current.browserTts || typeof window === "undefined") {
      return false;
    }

    const trimmed = String(text || "").trim();
    if (!trimmed) {
      return false;
    }

    window.speechSynthesis?.cancel();
    setIsPlayingSpeech(true);
    const utterance = new SpeechSynthesisUtterance(trimmed);
    utterance.lang = "en-US";
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.onend = () => {
      setIsPlayingSpeech(false);
    };
    utterance.onerror = () => {
      setIsPlayingSpeech(false);
      setNotice("Audio fallback failed. Read the tutor reply below.");
    };
    window.speechSynthesis?.speak(utterance);
    return true;
  }

  async function playCloudTts(text) {
    if (!sessionAccess?.session_id || !sessionAccess?.child_session_token) {
      return;
    }

    const response = await fetch(`/api/session/${sessionAccess.session_id}/speech/synthesize`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${sessionAccess.child_session_token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new ApiRequestError(payload?.message || "Unable to synthesize speech.", {
        status: response.status,
        code: payload?.error || null,
        payload
      });
    }

    const audioBlob = await response.blob();
    revokePlaybackResources();

    const objectUrl = URL.createObjectURL(audioBlob);
    playbackUrlRef.current = objectUrl;
    const audio = new Audio(objectUrl);
    playbackAudioRef.current = audio;
    setIsPlayingSpeech(true);

    audio.onended = () => {
      revokePlaybackResources();
    };
    audio.onerror = () => {
      revokePlaybackResources();
      setNotice("Audio playback failed. Read the tutor reply below.");
    };

    try {
      await audio.play();
    } catch {
      revokePlaybackResources();
      throw new Error("Audio playback is blocked right now. Read the tutor reply below.");
    }
  }

  function initializeFromSnapshot(messages = []) {
    spokenAssistantMessageIdsRef.current = new Set(
      messages.filter((message) => message.actor_type === "assistant").map((message) => message.id)
    );
  }

  function handleIncomingMessages(incoming = []) {
    if (!autoSpeakRef.current) {
      return;
    }

    const freshAssistantMessages = incoming.filter(
      (message) => message.actor_type === "assistant" && !spokenAssistantMessageIdsRef.current.has(message.id)
    );

    for (const message of freshAssistantMessages) {
      spokenAssistantMessageIdsRef.current.add(message.id);
    }

    const latest = freshAssistantMessages[freshAssistantMessages.length - 1];
    if (!latest) {
      return;
    }

    setPendingTutorReply(false);
    setNotice("");

    void (async () => {
      try {
        if (speechSupportRef.current.cloudTts) {
          await playCloudTts(latest.content);
          return;
        }
      } catch (speechError) {
        if (isChildAuthFailure(speechError)) {
          onSessionInvalid("Session token expired or invalid. Rejoin with a fresh code.");
          return;
        }

        setNotice("Cloud audio had an issue. Falling back to browser voice.");
      }

      const usedBrowserFallback = speakTextFallback(latest.content);
      if (!usedBrowserFallback) {
        setNotice("Audio unavailable right now. Read the tutor reply below.");
      }
    })();
  }

  async function transcribeCloudRecording(audioBlob) {
    if (!sessionAccess?.session_id || !sessionAccess?.child_session_token) {
      return;
    }

    const formData = new FormData();
    formData.append("audio", audioBlob, "utterance.webm");

    const payload = await apiFormRequest(`/api/session/${sessionAccess.session_id}/speech/transcribe`, {
      method: "POST",
      bearerToken: sessionAccess.child_session_token,
      formData
    });

    const transcript = String(payload?.transcript || "").trim();
    if (!transcript) {
      throw new Error("No speech transcript detected. Try speaking closer to the microphone.");
    }

    const baseInput = studentInputRef.current.trim();
    setStudentInput([baseInput, transcript].filter(Boolean).join(" "));
  }

  async function startCloudVoiceCapture() {
    if (!speechSupport.cloudStt || isCloudRecording || voiceBusy) {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: true,
          echoCancellation: true
        }
      });

      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setError("Voice recording failed. Hold to talk and try again.");
        setNotice("");
        setIsCloudRecording(false);
      };

      recorder.onstop = async () => {
        const chunks = [...audioChunksRef.current];
        audioChunksRef.current = [];
        setIsCloudRecording(false);

        if (mediaStreamRef.current) {
          for (const track of mediaStreamRef.current.getTracks()) {
            track.stop();
          }
          mediaStreamRef.current = null;
        }

        if (chunks.length === 0) {
          return;
        }

        setIsTranscribing(true);
        setNotice("Transcribing your voice...");
        try {
          await transcribeCloudRecording(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
          setError("");
          setNotice("Voice captured. You can send it now.");
        } catch (speechError) {
          if (isChildAuthFailure(speechError)) {
            onSessionInvalid("Session token expired or invalid. Rejoin with a fresh code.");
            return;
          }

          setError(classifySpeechFailure(speechError, "Voice transcription failed. Hold to talk and retry."));
          setNotice("");
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.start();
      setError("");
      setNotice("Listening. Release to transcribe.");
      setIsCloudRecording(true);
    } catch {
      setError("Microphone access is required for voice input.");
      setNotice("");
    }
  }

  function startBrowserVoiceCapture() {
    if (!speechSupport.browserStt || isListening || voiceBusy) {
      return;
    }

    const RecognitionCtor = getSpeechRecognitionCtor();
    if (!RecognitionCtor) {
      setError("Speech recognition is unavailable in this browser.");
      return;
    }

    const recognition = new RecognitionCtor();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    voiceBaseInputRef.current = studentInput.trim();
    voiceFinalTranscriptRef.current = "";

    recognition.onresult = (event) => {
      let interimTranscript = "";
      let finalTranscript = voiceFinalTranscriptRef.current;

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index][0]?.transcript ?? "";
        if (event.results[index].isFinal) {
          finalTranscript = `${finalTranscript} ${transcript}`.trim();
        } else {
          interimTranscript = `${interimTranscript} ${transcript}`.trim();
        }
      }

      voiceFinalTranscriptRef.current = finalTranscript;
      setStudentInput([voiceBaseInputRef.current, finalTranscript, interimTranscript].filter(Boolean).join(" "));
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setError("Microphone permission was denied. Enable mic access to use voice input.");
      } else {
        setError(`Voice input failed: ${event.error}`);
      }
      setNotice("");
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setIsListening(false);
      setNotice("");
    };

    try {
      recognitionRef.current = recognition;
      setError("");
      setNotice("Listening. Release to stop.");
      setIsListening(true);
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setIsListening(false);
      setError("Unable to start voice capture.");
      setNotice("");
    }
  }

  function startVoiceCapture() {
    if (speechSupport.cloudStt) {
      void startCloudVoiceCapture();
      return;
    }

    startBrowserVoiceCapture();
  }

  function stopVoiceCapture() {
    if (isCloudRecording) {
      stopCloudVoiceCapture();
      return;
    }

    stopBrowserVoiceCapture();
  }

  useEffect(() => {
    autoSpeakRef.current = autoSpeak;
  }, [autoSpeak]);

  useEffect(() => {
    speechSupportRef.current = speechSupport;
  }, [speechSupport]);

  useEffect(() => {
    studentInputRef.current = studentInput;
  }, [studentInput]);

  useEffect(() => {
    const support = {
      cloudStt: getCloudSttSupport(),
      browserStt: Boolean(getSpeechRecognitionCtor()),
      cloudTts: typeof window !== "undefined" && typeof Audio !== "undefined",
      browserTts: typeof window !== "undefined" && typeof window.speechSynthesis !== "undefined"
    };
    setSpeechSupport({
      ...support
    });
    speechSupportRef.current = support;

    return () => {
      stopAllVoiceCapture();
      revokePlaybackResources();
      if (typeof window !== "undefined") {
        window.speechSynthesis?.cancel();
      }
    };
  }, []);

  const turnStatus = useMemo(() => {
    if (isCloudRecording) {
      return "Listening. Release to transcribe.";
    }

    if (isListening) {
      return "Listening. Release to stop.";
    }

    if (isTranscribing) {
      return "Transcribing your voice...";
    }

    if (pendingTutorReply) {
      return "Tutor is thinking...";
    }

    if (isPlayingSpeech) {
      return "Tutor is speaking...";
    }

    return notice;
  }, [isCloudRecording, isListening, isTranscribing, pendingTutorReply, isPlayingSpeech, notice]);

  const listeningLabel = useMemo(() => {
    if (isCloudRecording) {
      return "Recording... release to transcribe";
    }

    if (isListening) {
      return "Listening... release to stop";
    }

    if (isTranscribing) {
      return "Transcribing...";
    }

    if (isPlayingSpeech) {
      return "Tutor speaking...";
    }

    return "Hold to talk";
  }, [isCloudRecording, isListening, isTranscribing, isPlayingSpeech]);

  return {
    state: {
      voiceBusy,
      isTranscribing,
      isPlayingSpeech,
      pendingTutorReply,
      turnStatus,
      speechSupport,
      isListening,
      isCloudRecording,
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
