import test from "node:test";
import assert from "node:assert/strict";
import React, { useState } from "react";
import { act } from "react";

import { ApiRequestError } from "../src/lib/http.js";
import { createUseCloudVoiceCaptureStrategy } from "../app/child/hooks/voice/useCloudVoiceCaptureStrategy.js";
import { createHookRenderer } from "./helpers/hook-test-renderer.js";

const originalClientVoiceTelemetrySetting = process.env.NEXT_PUBLIC_VOICE_TELEMETRY_DISABLED;
process.env.NEXT_PUBLIC_VOICE_TELEMETRY_DISABLED = "1";
test.after(() => {
  process.env.NEXT_PUBLIC_VOICE_TELEMETRY_DISABLED = originalClientVoiceTelemetrySetting;
});

function createRecorderFactory() {
  class FakeRecorder {
    constructor() {
      this.state = "inactive";
      this.mimeType = "audio/webm";
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
    createMediaRecorderImpl: () => new FakeRecorder()
  };
}

function createCloudHarnessHook(useCloudCaptureHook, options = {}) {
  const invalidMessages = [];

  function useHarness() {
    const [studentInput, setStudentInput] = useState(options.initialStudentInput ?? "");
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    const capture = useCloudCaptureHook({
      cloudSttEnabled: true,
      voiceBusy: false,
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
      }
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

test("useCloudVoiceCaptureStrategy transcribes cloud capture and updates input", async () => {
  const streamTracks = [{ stopped: false, stop() { this.stopped = true; } }];
  const { createMediaRecorderImpl } = createRecorderFactory();

  const useCloudCaptureHook = createUseCloudVoiceCaptureStrategy({
    getUserMediaImpl: async () => ({
      getTracks: () => streamTracks
    }),
    createMediaRecorderImpl,
    createBlobImpl: () => new Blob(["audio"]),
    apiFormRequestImpl: async () => ({
      transcript: "transcribed answer"
    })
  });

  const useHarness = createCloudHarnessHook(useCloudCaptureHook, { initialStudentInput: "Base input" });
  const renderer = await createHookRenderer(() => useHarness());

  await act(async () => {
    void renderer.getCurrent().capture.actions.startCloudVoiceCapture();
  });
  assert.equal(renderer.getCurrent().capture.state.isCloudRecording, true);

  await act(async () => {
    renderer.getCurrent().capture.actions.stopCloudVoiceCapture();
    await Promise.resolve();
    await Promise.resolve();
  });

  const state = renderer.getCurrent();
  assert.equal(state.capture.state.isCloudRecording, false);
  assert.equal(state.capture.state.isTranscribing, false);
  assert.equal(state.studentInput, "Base input transcribed answer");
  assert.equal(state.notice, "Voice captured. Tap Send when ready.");
  assert.equal(state.error, "");
  assert.equal(streamTracks[0].stopped, true);

  await renderer.unmount();
});

test("useCloudVoiceCaptureStrategy reports permission denied", async () => {
  const permissionDeniedError = new Error("Permission denied");
  permissionDeniedError.name = "NotAllowedError";

  const useCloudCaptureHook = createUseCloudVoiceCaptureStrategy({
    getUserMediaImpl: async () => {
      throw permissionDeniedError;
    }
  });

  const useHarness = createCloudHarnessHook(useCloudCaptureHook);
  const renderer = await createHookRenderer(() => useHarness());

  await act(async () => {
    void renderer.getCurrent().capture.actions.startCloudVoiceCapture();
  });

  assert.equal(renderer.getCurrent().error, "Please allow microphone access to use voice input.");
  await renderer.unmount();
});

test("useCloudVoiceCaptureStrategy routes invalid session failures to onSessionInvalid", async () => {
  const { createMediaRecorderImpl } = createRecorderFactory();
  const useCloudCaptureHook = createUseCloudVoiceCaptureStrategy({
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

  const useHarness = createCloudHarnessHook(useCloudCaptureHook);
  const renderer = await createHookRenderer(() => useHarness());

  await act(async () => {
    void renderer.getCurrent().capture.actions.startCloudVoiceCapture();
  });
  await act(async () => {
    renderer.getCurrent().capture.actions.stopCloudVoiceCapture();
    await Promise.resolve();
    await Promise.resolve();
  });

  const state = renderer.getCurrent();
  assert.equal(state.invalidMessages.length, 1);
  assert.equal(
    state.invalidMessages[0],
    "Your lesson code expired. Please ask your parent for a new code."
  );

  await renderer.unmount();
});
