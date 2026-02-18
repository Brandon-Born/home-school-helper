"use client";

import { useCallback, useRef } from "react";
import { isChildAuthFailure } from "../../../../src/lib/auth-failures.js";
import { ApiRequestError } from "../../../../src/lib/http.js";

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
        setNotice("Audio could not play. You can read the reply below.");
      };
      window.speechSynthesis?.speak(utterance);
      return true;
    },
    [setIsPlayingSpeech, setNotice, speechSupportRef]
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
        setNotice("Audio could not play. You can read the reply below.");
      };

      try {
        await audio.play();
      } catch {
        revokePlaybackResources();
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
      try {
        if (speechSupportRef.current.cloudTts) {
          await playCloudTts(text);
          return;
        }
      } catch (speechError) {
        if (isChildAuthFailure(speechError)) {
          onSessionInvalid("Your lesson code expired. Please ask your parent for a new code.");
          return;
        }

        setNotice("Audio had an issue. Switching to backup voice.");
      }

      const usedBrowserFallback = speakTextFallback(text);
      if (!usedBrowserFallback) {
        setNotice("Audio is unavailable right now. You can read the reply below.");
      }
    },
    [onSessionInvalid, playCloudTts, setNotice, speakTextFallback, speechSupportRef]
  );

  const resetPlayback = useCallback(() => {
    revokePlaybackResources();
    if (typeof window !== "undefined") {
      window.speechSynthesis?.cancel();
    }
  }, [revokePlaybackResources]);

  return {
    playAssistantText,
    resetPlayback
  };
}
