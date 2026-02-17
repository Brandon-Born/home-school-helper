"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { isChildAuthFailure } from "../../../src/lib/auth-failures.js";
import { ApiRequestError, apiFormRequest } from "../../../src/lib/http.js";
import { initializeSpokenAssistantMessageIds, takeFreshAssistantMessages } from "./voice/assistant-messages.js";
import { classifySpeechFailure } from "./voice/speech-errors.js";
import { detectSpeechSupport, getSpeechRecognitionCtor } from "./voice/speech-support.js";
import { getListeningLabelText, getTurnStatusText, getVoiceStatusText } from "./voice/speech-status.js";

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

  const voiceStatus = useMemo(() => getVoiceStatusText(speechSupport), [speechSupport]);

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
      setNotice("Audio could not play. You can read the tutor reply below.");
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
      setNotice("Audio could not play. You can read the tutor reply below.");
    };

    try {
      await audio.play();
    } catch {
      revokePlaybackResources();
      throw new Error("Audio playback is blocked right now. You can read the tutor reply below.");
    }
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
      try {
        if (speechSupportRef.current.cloudTts) {
          await playCloudTts(latest.content);
          return;
        }
      } catch (speechError) {
        if (isChildAuthFailure(speechError)) {
          onSessionInvalid("Your lesson code expired. Please ask your parent for a new code.");
          return;
        }

        setNotice("Audio had an issue. Switching to backup voice.");
      }

      const usedBrowserFallback = speakTextFallback(latest.content);
      if (!usedBrowserFallback) {
        setNotice("Audio is unavailable right now. You can read the tutor reply below.");
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
      throw new Error("We could not hear that clearly. Try again closer to the microphone.");
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
        setError("Recording failed. Hold to talk and try again.");
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
        setNotice("Turning your voice into text...");
        try {
          await transcribeCloudRecording(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
          setError("");
          setNotice("Voice captured. Tap Ask Tutor when ready.");
        } catch (speechError) {
          if (isChildAuthFailure(speechError)) {
            onSessionInvalid("Your lesson code expired. Please ask your parent for a new code.");
            return;
          }

          setError(classifySpeechFailure(speechError, "We could not turn that into text. Hold to talk and try again."));
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
      setError("Please allow microphone access to use voice input.");
      setNotice("");
    }
  }

  function startBrowserVoiceCapture() {
    if (!speechSupport.browserStt || isListening || voiceBusy) {
      return;
    }

    const RecognitionCtor = getSpeechRecognitionCtor();
    if (!RecognitionCtor) {
      setError("Voice input is not available in this browser.");
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
        setError("Microphone permission is off. Turn it on to use voice input.");
      } else {
        setError(`Voice input stopped: ${event.error}`);
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
      setError("Could not start voice input.");
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
    const support = detectSpeechSupport();
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
    return getTurnStatusText({
      isCloudRecording,
      isListening,
      isTranscribing,
      pendingTutorReply,
      isPlayingSpeech,
      notice
    });
  }, [isCloudRecording, isListening, isTranscribing, pendingTutorReply, isPlayingSpeech, notice]);

  const listeningLabel = useMemo(() => {
    return getListeningLabelText({
      isCloudRecording,
      isListening,
      isTranscribing,
      isPlayingSpeech
    });
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
