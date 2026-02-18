"use client";

import { useCallback, useRef, useState } from "react";
import { getVoiceErrorDetails, logClientVoiceMetric } from "../../../../src/lib/voice-telemetry.js";
import { getSpeechRecognitionCtor } from "./speech-support.js";

export function createUseBrowserVoiceCaptureStrategy({
  getSpeechRecognitionCtorImpl = getSpeechRecognitionCtor
} = {}) {
  return function useBrowserVoiceCaptureStrategy({
    browserSttEnabled,
    voiceBusy,
    sessionAccess,
    studentInput,
    setStudentInput,
    setError,
    setNotice
  }) {
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef(null);
    const voiceBaseInputRef = useRef("");
    const voiceFinalTranscriptRef = useRef("");

    const stopBrowserVoiceCapture = useCallback(() => {
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
    }, []);

    const stopAllBrowserVoiceCapture = useCallback(() => {
      stopBrowserVoiceCapture();
      setIsListening(false);
    }, [stopBrowserVoiceCapture]);

    const startBrowserVoiceCapture = useCallback(() => {
      if (!browserSttEnabled || isListening || voiceBusy) {
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
    }, [
      browserSttEnabled,
      getSpeechRecognitionCtorImpl,
      isListening,
      sessionAccess?.session_id,
      setError,
      setNotice,
      setStudentInput,
      studentInput,
      voiceBusy
    ]);

    return {
      state: {
        isListening
      },
      actions: {
        startBrowserVoiceCapture,
        stopBrowserVoiceCapture,
        stopAllBrowserVoiceCapture
      }
    };
  };
}

export const useBrowserVoiceCaptureStrategy = createUseBrowserVoiceCaptureStrategy();
