"use client";

import { useEffect, useRef, useState } from "react";
import { isChildAuthFailure } from "../../../../src/lib/auth-failures.js";
import { apiFormRequest } from "../../../../src/lib/http.js";
import { getVoiceErrorDetails, logClientVoiceMetric } from "../../../../src/lib/voice-telemetry.js";
import { classifySpeechFailure } from "./speech-errors.js";
import { detectSpeechSupport, getSpeechRecognitionCtor } from "./speech-support.js";

const initialSpeechSupport = {
  cloudStt: false,
  browserStt: false,
  cloudTts: false,
  browserTts: false
};

export function createUseChildVoiceCapture({
  apiFormRequestImpl = apiFormRequest,
  detectSpeechSupportImpl = detectSpeechSupport,
  getSpeechRecognitionCtorImpl = getSpeechRecognitionCtor,
  getUserMediaImpl = async (constraints) => navigator.mediaDevices.getUserMedia(constraints),
  createMediaRecorderImpl = (stream) => new MediaRecorder(stream),
  createBlobImpl = (chunks, options) => new Blob(chunks, options)
} = {}) {
  return function useChildVoiceCapture({
    sessionAccess,
    studentInput,
    setStudentInput,
    setError,
    setNotice,
    onSessionInvalid,
    isPlayingSpeech,
    speechSupportRef
  }) {
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [speechSupport, setSpeechSupport] = useState(initialSpeechSupport);
    const [isListening, setIsListening] = useState(false);
    const [isCloudRecording, setIsCloudRecording] = useState(false);

    const recognitionRef = useRef(null);
    const voiceBaseInputRef = useRef("");
    const voiceFinalTranscriptRef = useRef("");
    const mediaRecorderRef = useRef(null);
    const mediaStreamRef = useRef(null);
    const audioChunksRef = useRef([]);
    const studentInputRef = useRef(studentInput);

    const voiceBusy = isTranscribing || isPlayingSpeech;

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
      setIsTranscribing(false);
    }

    async function transcribeCloudRecording(audioBlob) {
      if (!sessionAccess?.session_id || !sessionAccess?.child_session_token) {
        return;
      }

      const formData = new FormData();
      formData.append("audio", audioBlob, "utterance.webm");

      const payload = await apiFormRequestImpl(`/api/session/${sessionAccess.session_id}/speech/transcribe`, {
        method: "POST",
        bearerToken: sessionAccess.child_session_token,
        formData
      });

      const transcript = String(payload?.transcript || "").trim();
      if (!transcript) {
        logClientVoiceMetric(
          "cloud_stt_empty_transcript",
          {
            transport: "cloud_stt",
            session_id: sessionAccess.session_id
          },
          { level: "warn" }
        );
        throw new Error("We could not hear that clearly. Try again closer to the microphone.");
      }

      const baseInput = studentInputRef.current.trim();
      setStudentInput([baseInput, transcript].filter(Boolean).join(" "));
      logClientVoiceMetric("cloud_stt_transcribe_success", {
        transport: "cloud_stt",
        session_id: sessionAccess.session_id
      });
    }

    async function startCloudVoiceCapture() {
      if (!speechSupport.cloudStt || isCloudRecording || voiceBusy) {
        return;
      }

      try {
        const stream = await getUserMediaImpl({
          audio: {
            noiseSuppression: true,
            echoCancellation: true
          }
        });

        mediaStreamRef.current = stream;
        audioChunksRef.current = [];

        const recorder = createMediaRecorderImpl(stream);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        recorder.onerror = () => {
          logClientVoiceMetric(
            "cloud_stt_recording_error",
            {
              transport: "cloud_stt",
              session_id: sessionAccess?.session_id ?? null
            },
            { level: "warn" }
          );
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
            logClientVoiceMetric(
              "cloud_stt_empty_audio",
              {
                transport: "cloud_stt",
                session_id: sessionAccess?.session_id ?? null
              },
              { level: "warn" }
            );
            return;
          }

          setIsTranscribing(true);
          setNotice("Turning your voice into text...");
          try {
            await transcribeCloudRecording(createBlobImpl(chunks, { type: recorder.mimeType || "audio/webm" }));
            setError("");
            setNotice("Voice captured. Tap Send when ready.");
          } catch (speechError) {
            if (isChildAuthFailure(speechError)) {
              logClientVoiceMetric(
                "voice_session_invalid",
                {
                  transport: "cloud_stt",
                  session_id: sessionAccess?.session_id ?? null,
                  ...getVoiceErrorDetails(speechError)
                },
                { level: "warn" }
              );
              onSessionInvalid("Your lesson code expired. Please ask your parent for a new code.");
              return;
            }

            logClientVoiceMetric(
              "cloud_stt_transcribe_failed",
              {
                transport: "cloud_stt",
                session_id: sessionAccess?.session_id ?? null,
                ...getVoiceErrorDetails(speechError)
              },
              { level: "warn" }
            );
            setError(classifySpeechFailure(speechError, "We could not turn that into text. Hold to talk and try again."));
            setNotice("");
          } finally {
            setIsTranscribing(false);
          }
        };

        recorder.start();
        logClientVoiceMetric("cloud_stt_recording_start", {
          transport: "cloud_stt",
          session_id: sessionAccess?.session_id ?? null
        });
        setError("");
        setNotice("Listening. Release to transcribe.");
        setIsCloudRecording(true);
      } catch (captureError) {
        const denied =
          captureError && typeof captureError === "object"
            ? captureError.name === "NotAllowedError" || captureError.name === "PermissionDeniedError"
            : false;
        logClientVoiceMetric(
          denied ? "microphone_permission_denied" : "cloud_stt_start_failed",
          {
            transport: "cloud_stt",
            session_id: sessionAccess?.session_id ?? null,
            ...getVoiceErrorDetails(captureError)
          },
          { level: "warn" }
        );
        setError("Please allow microphone access to use voice input.");
        setNotice("");
      }
    }

    function startBrowserVoiceCapture() {
      if (!speechSupport.browserStt || isListening || voiceBusy) {
        return;
      }

      const RecognitionCtor = getSpeechRecognitionCtorImpl();
      if (!RecognitionCtor) {
        logClientVoiceMetric(
          "browser_stt_unavailable",
          {
            transport: "browser_stt",
            session_id: sessionAccess?.session_id ?? null
          },
          { level: "warn" }
        );
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
          logClientVoiceMetric(
            "microphone_permission_denied",
            {
              transport: "browser_stt",
              session_id: sessionAccess?.session_id ?? null,
              speech_error: event.error
            },
            { level: "warn" }
          );
          setError("Microphone permission is off. Turn it on to use voice input.");
        } else {
          logClientVoiceMetric(
            "browser_stt_error",
            {
              transport: "browser_stt",
              session_id: sessionAccess?.session_id ?? null,
              speech_error: event.error
            },
            { level: "warn" }
          );
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
        logClientVoiceMetric("browser_stt_start", {
          transport: "browser_stt",
          session_id: sessionAccess?.session_id ?? null
        });
      } catch (captureError) {
        recognitionRef.current = null;
        setIsListening(false);
        logClientVoiceMetric(
          "browser_stt_start_failed",
          {
            transport: "browser_stt",
            session_id: sessionAccess?.session_id ?? null,
            ...getVoiceErrorDetails(captureError)
          },
          { level: "warn" }
        );
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
      studentInputRef.current = studentInput;
    }, [studentInput]);

    useEffect(() => {
      const support = detectSpeechSupportImpl();
      setSpeechSupport({
        ...support
      });
      speechSupportRef.current = support;

      return () => {
        stopAllVoiceCapture();
      };
    }, []);

    useEffect(() => {
      speechSupportRef.current = speechSupport;
    }, [speechSupport, speechSupportRef]);

    return {
      state: {
        isTranscribing,
        speechSupport,
        isListening,
        isCloudRecording
      },
      actions: {
        startVoiceCapture,
        stopVoiceCapture,
        stopAllVoiceCapture
      }
    };
  };
}

export const useChildVoiceCapture = createUseChildVoiceCapture();
