import test from "node:test";
import assert from "node:assert/strict";
import React, { useRef, useState } from "react";
import TestRenderer from "react-test-renderer";

import { ApiRequestError } from "../src/lib/http.js";
import { createUseChildVoiceCapture } from "../app/child/hooks/voice/useChildVoiceCapture.js";
import { createHookRenderer, flushEffects } from "./helpers/hook-test-renderer.js";

const { act } = TestRenderer;

const originalClientVoiceTelemetrySetting = process.env.NEXT_PUBLIC_VOICE_TELEMETRY_DISABLED;
process.env.NEXT_PUBLIC_VOICE_TELEMETRY_DISABLED = "1";
test.after(() => {
  process.env.NEXT_PUBLIC_VOICE_TELEMETRY_DISABLED = originalClientVoiceTelemetrySetting;
});

function createRecorderFactory() {
  const recorders = [];

  class FakeRecorder {
    constructor() {
      this.state = "inactive";
      this.mimeType = "audio/webm";
      recorders.push(this);
    }

    start() {
      this.state = "recording";
    }

    stop() {
      this.state = "inactive";
      this.ondataavailable?.({
        data: {
          size: 4
        }
      });
      this.onstop?.();
    }
  }

  return {
    recorders,
    createMediaRecorderImpl: () => new FakeRecorder()
  };
}

function createHarnessHook(useChildVoiceCaptureHook, options = {}) {
  const invalidMessages = [];

  function useHarness() {
    const [studentInput, setStudentInput] = useState(options.initialStudentInput ?? "");
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const speechSupportRef = useRef({
      cloudStt: false,
      browserStt: false,
      cloudTts: false,
      browserTts: false
    });

    const capture = useChildVoiceCaptureHook({
      sessionAccess: {
        session_id: "session_1",
        child_session_token: "token_1"
      },
      studentInput,
      setStudentInput,
      setError,
      setNotice,
      onSessionInvalid: (message) => {
        invalidMessages.push(message);
      },
      isPlayingSpeech: false,
      speechSupportRef
    });

    return {
      capture,
      studentInput,
      error,
      notice,
      invalidMessages
    };
  }

  return useHarness;
}

test("useChildVoiceCapture transcribes cloud capture and updates input state", async () => {
  const streamTracks = [{ stopped: false, stop() { this.stopped = true; } }];
  const { createMediaRecorderImpl } = createRecorderFactory();

  const useChildVoiceCaptureHook = createUseChildVoiceCapture({
    detectSpeechSupportImpl: () => ({
      cloudStt: true,
      browserStt: false,
      cloudTts: false,
      browserTts: false
    }),
    getUserMediaImpl: async () => ({
      getTracks: () => streamTracks
    }),
    createMediaRecorderImpl,
    createBlobImpl: () => new Blob(["audio"]),
    apiFormRequestImpl: async () => ({
      transcript: "transcribed answer"
    })
  });

  const useHarness = createHarnessHook(useChildVoiceCaptureHook, { initialStudentInput: "Base input" });
  const renderer = await createHookRenderer(() => useHarness());
  await flushEffects();

  for (let attempt = 0; attempt < 8 && !renderer.getCurrent().capture.state.speechSupport.cloudStt; attempt += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }

  await act(async () => {
    renderer.getCurrent().capture.actions.startVoiceCapture();
  });

  for (
    let attempt = 0;
    attempt < 8 &&
    !renderer.getCurrent().capture.state.isCloudRecording &&
    !renderer.getCurrent().capture.state.isTranscribing;
    attempt += 1
  ) {
    await act(async () => {
      await Promise.resolve();
    });
  }

  await act(async () => {
    renderer.getCurrent().capture.actions.stopVoiceCapture();
    await Promise.resolve();
    await Promise.resolve();
  });

  const hookValue = renderer.getCurrent();
  assert.equal(hookValue.capture.state.isCloudRecording, false);
  assert.equal(hookValue.capture.state.isTranscribing, false);
  assert.equal(hookValue.studentInput, "Base input transcribed answer");
  assert.equal(hookValue.notice, "Voice captured. Tap Send when ready.");
  assert.equal(hookValue.error, "");
  assert.equal(streamTracks[0].stopped, true);

  await renderer.unmount();
});

test("useChildVoiceCapture reports permission denied and auth invalidation failures", async () => {
  const permissionDeniedError = new Error("Permission denied");
  permissionDeniedError.name = "NotAllowedError";

  const usePermissionDeniedHook = createUseChildVoiceCapture({
    detectSpeechSupportImpl: () => ({
      cloudStt: true,
      browserStt: false,
      cloudTts: false,
      browserTts: false
    }),
    getUserMediaImpl: async () => {
      throw permissionDeniedError;
    }
  });

  const useDeniedHarness = createHarnessHook(usePermissionDeniedHook);
  const deniedRenderer = await createHookRenderer(() => useDeniedHarness());
  await flushEffects();
  await act(async () => {
    deniedRenderer.getCurrent().capture.actions.startVoiceCapture();
  });
  assert.equal(deniedRenderer.getCurrent().error, "Please allow microphone access to use voice input.");
  await deniedRenderer.unmount();

  const { createMediaRecorderImpl } = createRecorderFactory();
  const useInvalidSessionHook = createUseChildVoiceCapture({
    detectSpeechSupportImpl: () => ({
      cloudStt: true,
      browserStt: false,
      cloudTts: false,
      browserTts: false
    }),
    getUserMediaImpl: async () => ({
      getTracks: () => []
    }),
    createMediaRecorderImpl,
    createBlobImpl: () => new Blob(["audio"]),
    apiFormRequestImpl: async () => {
      throw new ApiRequestError("Session token expired.", {
        status: 401,
        code: "invalid_child_session_token"
      });
    }
  });

  const useInvalidHarness = createHarnessHook(useInvalidSessionHook);
  const invalidRenderer = await createHookRenderer(() => useInvalidHarness());
  await flushEffects();
  await act(async () => {
    invalidRenderer.getCurrent().capture.actions.startVoiceCapture();
  });
  await act(async () => {
    invalidRenderer.getCurrent().capture.actions.stopVoiceCapture();
    await Promise.resolve();
    await Promise.resolve();
  });

  const invalidState = invalidRenderer.getCurrent();
  assert.equal(invalidState.invalidMessages.length, 1);
  assert.equal(
    invalidState.invalidMessages[0],
    "Your lesson code expired. Please ask your parent for a new code."
  );

  await invalidRenderer.unmount();
});
