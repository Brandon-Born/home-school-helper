"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isChildAuthFailure } from "../../../../src/lib/auth-failures.js";
import { apiFormRequest } from "../../../../src/lib/http.js";
import { trackProductEvent } from "../../../../src/lib/product-analytics.js";
import { getVoiceErrorDetails, logClientVoiceMetric } from "../../../../src/lib/voice-telemetry.js";
import { classifySpeechFailure } from "./speech-errors.js";

export function createUseCloudVoiceCaptureStrategy({
  apiFormRequestImpl = apiFormRequest,
  getUserMediaImpl = async (constraints) => navigator.mediaDevices.getUserMedia(constraints),
  createMediaRecorderImpl = (stream) => new MediaRecorder(stream),
  createBlobImpl = (chunks, options) => new Blob(chunks, options),
  trackProductEventImpl = trackProductEvent
} = {}) {
  return function useCloudVoiceCaptureStrategy({
    cloudSttEnabled,
    voiceBusy,
    sessionAccess,
    studentInput,
    setStudentInput,
    setError,
    setNotice,
    onSessionInvalid
  }) {
    const [isCloudRecording, setIsCloudRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);

    const mediaRecorderRef = useRef(null);
    const mediaStreamRef = useRef(null);
    const audioChunksRef = useRef([]);
    const studentInputRef = useRef(studentInput);

    useEffect(() => {
      studentInputRef.current = studentInput;
    }, [studentInput]);

    const stopCloudVoiceCapture = useCallback(() => {
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
    }, []);

    const stopAllCloudVoiceCapture = useCallback(() => {
      stopCloudVoiceCapture();

      if (mediaStreamRef.current) {
        for (const track of mediaStreamRef.current.getTracks()) {
          track.stop();
        }
        mediaStreamRef.current = null;
      }

      setIsCloudRecording(false);
      setIsTranscribing(false);
    }, [stopCloudVoiceCapture]);

    const transcribeCloudRecording = useCallback(
      async (audioBlob) => {
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
        trackProductEventImpl("voice_usage", {
          status: "transcribed",
          transport: "cloud_stt"
        });
      },
      [apiFormRequestImpl, sessionAccess?.child_session_token, sessionAccess?.session_id, setStudentInput, trackProductEventImpl]
    );

    const startCloudVoiceCapture = useCallback(async () => {
      if (!cloudSttEnabled || isCloudRecording || voiceBusy) {
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
          setError("Recording failed. Tap to talk and try again.");
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
            trackProductEventImpl("voice_usage", {
              status: "failed",
              transport: "cloud_stt"
            });
            setError(classifySpeechFailure(speechError, "We could not turn that into text. Tap to talk and try again."));
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
        trackProductEventImpl("voice_usage", {
          status: "started",
          transport: "cloud_stt"
        });
        setError("");
        setNotice("Listening. Tap to transcribe.");
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
        trackProductEventImpl("voice_usage", {
          status: denied ? "permission_denied" : "failed",
          transport: "cloud_stt"
        });
        setError("Please allow microphone access to use voice input.");
        setNotice("");
      }
    }, [
      cloudSttEnabled,
      createBlobImpl,
      createMediaRecorderImpl,
      getUserMediaImpl,
      isCloudRecording,
      onSessionInvalid,
      sessionAccess?.session_id,
      setError,
      setNotice,
      trackProductEventImpl,
      transcribeCloudRecording,
      voiceBusy
    ]);

    useEffect(() => {
      return () => {
        stopAllCloudVoiceCapture();
      };
    }, [stopAllCloudVoiceCapture]);

    return {
      state: {
        isCloudRecording,
        isTranscribing
      },
      actions: {
        startCloudVoiceCapture,
        stopCloudVoiceCapture,
        stopAllCloudVoiceCapture
      }
    };
  };
}

export const useCloudVoiceCaptureStrategy = createUseCloudVoiceCaptureStrategy();
