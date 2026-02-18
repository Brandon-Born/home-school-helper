"use client";

import { useCallback, useRef } from "react";
import { isChildAuthFailure } from "../../../../src/lib/auth-failures.js";
import { ApiRequestError } from "../../../../src/lib/http.js";
import { getVoiceErrorDetails, logClientVoiceMetric } from "../../../../src/lib/voice-telemetry.js";
import { CLOUD_TTS_COOLDOWN_MS, shouldCooldownCloudTts } from "./cloud-tts-policy.js";

const CLOUD_TTS_CLIENT_TIMEOUT_MS = 6500;

export function useVoicePlayback({
  sessionAccess,
  speechSupportRef,
  setIsPlayingSpeech,
  setNotice,
  onSessionInvalid
}) {
  const playbackAudioRef = useRef(null);
  const playbackUrlRef = useRef(null);
  const cloudTtsCooldownUntilRef = useRef(0);
  const cloudTtsFallbackNoticeShownRef = useRef(false);

  const revokePlaybackResources = useCallback(() => {
    if (playbackAudioRef.current) {
      playbackAudioRef.current.pause();
      playbackAudioRef.current = null;
    }

    if (playbackUrlRef.current) {
      URL.revokeObjectURL(playbackUrlRef.current);
      playbackUrlRef.current = null;
    }

    setIsPlayingSpeech(false);
  }, [setIsPlayingSpeech]);

  const speakTextFallback = useCallback(
    (text) => {
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
        logClientVoiceMetric(
          "browser_tts_playback_error",
          {
            transport: "browser_tts",
            session_id: sessionAccess?.session_id ?? null
          },
          { level: "warn" }
        );
        setNotice("Audio could not play. You can read the reply below.");
      };
      window.speechSynthesis?.speak(utterance);
      return true;
    },
    [sessionAccess?.session_id, setIsPlayingSpeech, setNotice, speechSupportRef]
  );

  const playCloudTts = useCallback(
    async (text) => {
      if (!sessionAccess?.session_id || !sessionAccess?.child_session_token) {
        return;
      }

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => {
        controller.abort();
      }, CLOUD_TTS_CLIENT_TIMEOUT_MS);
      logClientVoiceMetric("cloud_tts_attempt", {
        transport: "cloud_tts",
        session_id: sessionAccess.session_id
      });

      let response;
      try {
        response = await fetch(`/api/session/${sessionAccess.session_id}/speech/synthesize`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${sessionAccess.child_session_token}`,
            "content-type": "application/json"
          },
          body: JSON.stringify({ text }),
          signal: controller.signal
        });
      } catch (fetchError) {
        if (fetchError && typeof fetchError === "object" && fetchError.name === "AbortError") {
          throw new ApiRequestError("Voice took too long. Switching to backup voice.", {
            status: 504,
            code: "speech_provider_timeout"
          });
        }

        throw fetchError;
      } finally {
        clearTimeout(timeoutId);
      }

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
        logClientVoiceMetric(
          "cloud_tts_audio_element_error",
          {
            transport: "cloud_tts",
            session_id: sessionAccess.session_id
          },
          { level: "warn" }
        );
        setNotice("Audio could not play. You can read the reply below.");
      };

      try {
        await audio.play();
        logClientVoiceMetric("cloud_tts_success", {
          transport: "cloud_tts",
          session_id: sessionAccess.session_id
        });
      } catch {
        revokePlaybackResources();
        logClientVoiceMetric(
          "tts_autoplay_blocked",
          {
            transport: "cloud_tts",
            session_id: sessionAccess.session_id
          },
          { level: "warn" }
        );
        throw new Error("Audio playback is blocked right now. You can read the reply below.");
      }
    },
    [
      revokePlaybackResources,
      sessionAccess?.child_session_token,
      sessionAccess?.session_id,
      setIsPlayingSpeech,
      setNotice
    ]
  );

  const playAssistantText = useCallback(
    async (text) => {
      const now = Date.now();
      const canAttemptCloudTts =
        speechSupportRef.current.cloudTts && now >= cloudTtsCooldownUntilRef.current;

      try {
        if (canAttemptCloudTts) {
          await playCloudTts(text);
          cloudTtsCooldownUntilRef.current = 0;
          cloudTtsFallbackNoticeShownRef.current = false;
          return;
        }
        if (speechSupportRef.current.cloudTts) {
          logClientVoiceMetric("cloud_tts_fallback", {
            reason: "cooldown_active",
            transport: "browser_tts",
            session_id: sessionAccess?.session_id ?? null
          });
        }
      } catch (speechError) {
        if (isChildAuthFailure(speechError)) {
          logClientVoiceMetric(
            "voice_session_invalid",
            {
              session_id: sessionAccess?.session_id ?? null,
              ...getVoiceErrorDetails(speechError)
            },
            { level: "warn" }
          );
          onSessionInvalid("Your lesson code expired. Please ask your parent for a new code.");
          return;
        }

        if (shouldCooldownCloudTts(speechError)) {
          cloudTtsCooldownUntilRef.current = Date.now() + CLOUD_TTS_COOLDOWN_MS;
          if (!cloudTtsFallbackNoticeShownRef.current) {
            setNotice("Audio service is unstable. Using backup voice for a bit.");
            cloudTtsFallbackNoticeShownRef.current = true;
          }
          logClientVoiceMetric(
            "cloud_tts_fallback",
            {
              reason: "provider_unstable",
              transport: "browser_tts",
              session_id: sessionAccess?.session_id ?? null,
              ...getVoiceErrorDetails(speechError)
            },
            { level: "warn" }
          );
        } else {
          logClientVoiceMetric(
            "cloud_tts_fallback",
            {
              reason: "request_failed",
              transport: "browser_tts",
              session_id: sessionAccess?.session_id ?? null,
              ...getVoiceErrorDetails(speechError)
            },
            { level: "warn" }
          );
          setNotice("Audio had an issue. Switching to backup voice.");
        }
      }

      const usedBrowserFallback = speakTextFallback(text);
      if (!usedBrowserFallback) {
        logClientVoiceMetric(
          "tts_unavailable",
          {
            reason: "no_browser_fallback",
            session_id: sessionAccess?.session_id ?? null
          },
          { level: "warn" }
        );
        setNotice("Audio is unavailable right now. You can read the reply below.");
      } else if (speechSupportRef.current.cloudTts) {
        logClientVoiceMetric("browser_tts_fallback_used", {
          transport: "browser_tts",
          session_id: sessionAccess?.session_id ?? null
        });
      }
    },
    [onSessionInvalid, playCloudTts, sessionAccess?.session_id, setNotice, speakTextFallback, speechSupportRef]
  );

  const resetPlayback = useCallback(() => {
    revokePlaybackResources();
    cloudTtsCooldownUntilRef.current = 0;
    cloudTtsFallbackNoticeShownRef.current = false;
    if (typeof window !== "undefined") {
      window.speechSynthesis?.cancel();
    }
  }, [revokePlaybackResources]);

  return {
    playAssistantText,
    resetPlayback
  };
}
