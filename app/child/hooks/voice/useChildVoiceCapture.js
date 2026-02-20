"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { trackProductEvent } from "../../../../src/lib/product-analytics.js";
import { detectSpeechSupport } from "./speech-support.js";
import { createUseBrowserVoiceCaptureStrategy } from "./useBrowserVoiceCaptureStrategy.js";
import { createUseCloudVoiceCaptureStrategy } from "./useCloudVoiceCaptureStrategy.js";

const initialSpeechSupport = {
  cloudStt: false,
  browserStt: false,
  cloudTts: false,
  browserTts: false
};

export function createUseChildVoiceCapture({
  detectSpeechSupportImpl = detectSpeechSupport,
  useCloudVoiceCaptureStrategyHook = null,
  useBrowserVoiceCaptureStrategyHook = null,
  apiFormRequestImpl,
  getUserMediaImpl,
  createMediaRecorderImpl,
  createBlobImpl,
  getSpeechRecognitionCtorImpl,
  trackProductEventImpl = trackProductEvent
} = {}) {
  const useCloudCaptureHook =
    useCloudVoiceCaptureStrategyHook ||
    createUseCloudVoiceCaptureStrategy({
      apiFormRequestImpl,
      getUserMediaImpl,
      createMediaRecorderImpl,
      createBlobImpl,
      trackProductEventImpl
    });
  const useBrowserCaptureHook =
    useBrowserVoiceCaptureStrategyHook ||
    createUseBrowserVoiceCaptureStrategy({
      getSpeechRecognitionCtorImpl,
      trackProductEventImpl
    });

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
    const [speechSupport, setSpeechSupport] = useState(initialSpeechSupport);

    const voiceBusy = isPlayingSpeech;

    const cloudCapture = useCloudCaptureHook({
      cloudSttEnabled: speechSupport.cloudStt,
      voiceBusy,
      sessionAccess,
      studentInput,
      setStudentInput,
      setError,
      setNotice,
      onSessionInvalid
    });

    const browserCapture = useBrowserCaptureHook({
      browserSttEnabled: speechSupport.browserStt,
      voiceBusy: voiceBusy || cloudCapture.state.isTranscribing,
      sessionAccess,
      studentInput,
      setStudentInput,
      setError,
      setNotice
    });

    const stopAllBrowserVoiceCapture = browserCapture.actions.stopAllBrowserVoiceCapture;
    const stopAllCloudVoiceCapture = cloudCapture.actions.stopAllCloudVoiceCapture;
    const startCloudVoiceCapture = cloudCapture.actions.startCloudVoiceCapture;
    const startBrowserVoiceCapture = browserCapture.actions.startBrowserVoiceCapture;
    const stopCloudVoiceCapture = cloudCapture.actions.stopCloudVoiceCapture;
    const stopBrowserVoiceCapture = browserCapture.actions.stopBrowserVoiceCapture;
    const stopAllVoiceCaptureRef = useRef(() => {});

    const stopAllVoiceCapture = useCallback(() => {
      stopAllBrowserVoiceCapture();
      stopAllCloudVoiceCapture();
    }, [stopAllBrowserVoiceCapture, stopAllCloudVoiceCapture]);

    const startVoiceCapture = useCallback(() => {
      if (speechSupport.cloudStt) {
        void startCloudVoiceCapture();
        return;
      }

      startBrowserVoiceCapture();
    }, [speechSupport.cloudStt, startBrowserVoiceCapture, startCloudVoiceCapture]);

    const stopVoiceCapture = useCallback(() => {
      if (cloudCapture.state.isCloudRecording) {
        stopCloudVoiceCapture();
        return;
      }

      stopBrowserVoiceCapture();
    }, [cloudCapture.state.isCloudRecording, stopBrowserVoiceCapture, stopCloudVoiceCapture]);

    useEffect(() => {
      const support = detectSpeechSupportImpl();
      setSpeechSupport({
        ...support
      });
      speechSupportRef.current = support;
    }, [detectSpeechSupportImpl, speechSupportRef]);

    useEffect(() => {
      speechSupportRef.current = speechSupport;
    }, [speechSupport, speechSupportRef]);

    useEffect(() => {
      stopAllVoiceCaptureRef.current = stopAllVoiceCapture;
    }, [stopAllVoiceCapture]);

    useEffect(() => {
      return () => {
        stopAllVoiceCaptureRef.current();
      };
    }, []);

    return {
      state: {
        isTranscribing: cloudCapture.state.isTranscribing,
        speechSupport,
        isListening: browserCapture.state.isListening,
        isCloudRecording: cloudCapture.state.isCloudRecording
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
