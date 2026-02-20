import test from "node:test";
import assert from "node:assert/strict";
import React, { useState } from "react";
import { act } from "react";

import { createUseBrowserVoiceCaptureStrategy } from "../app/child/hooks/voice/useBrowserVoiceCaptureStrategy.js";
import { createHookRenderer } from "./helpers/hook-test-renderer.js";

const originalClientVoiceTelemetrySetting = process.env.NEXT_PUBLIC_VOICE_TELEMETRY_DISABLED;
process.env.NEXT_PUBLIC_VOICE_TELEMETRY_DISABLED = "1";
test.after(() => {
  process.env.NEXT_PUBLIC_VOICE_TELEMETRY_DISABLED = originalClientVoiceTelemetrySetting;
});

function createRecognitionFactory() {
  const recognitions = [];

  class FakeRecognition {
    constructor() {
      this.lang = "";
      this.interimResults = false;
      this.continuous = false;
      this.maxAlternatives = 1;
      recognitions.push(this);
    }

    start() {}

    stop() {
      this.onend?.();
    }
  }

  return {
    recognitions,
    getSpeechRecognitionCtorImpl: () => FakeRecognition
  };
}

function createBrowserHarnessHook(useBrowserCaptureHook, options = {}) {
  function useHarness() {
    const [studentInput, setStudentInput] = useState(options.initialStudentInput ?? "");
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    const capture = useBrowserCaptureHook({
      browserSttEnabled: true,
      voiceBusy: false,
      sessionAccess: {
        session_id: "session_1",
        child_session_token: "token_1"
      },
      studentInput,
      setStudentInput,
      setError,
      setNotice
    });

    return {
      capture,
      studentInput,
      error,
      notice
    };
  }

  return useHarness;
}

test("useBrowserVoiceCaptureStrategy applies interim and final transcripts", async () => {
  const { recognitions, getSpeechRecognitionCtorImpl } = createRecognitionFactory();
  const useBrowserCaptureHook = createUseBrowserVoiceCaptureStrategy({
    getSpeechRecognitionCtorImpl
  });

  const useHarness = createBrowserHarnessHook(useBrowserCaptureHook, { initialStudentInput: "Base" });
  const renderer = await createHookRenderer(() => useHarness());

  await act(async () => {
    renderer.getCurrent().capture.actions.startBrowserVoiceCapture();
  });
  assert.equal(renderer.getCurrent().capture.state.isListening, true);
  assert.equal(renderer.getCurrent().notice, "Listening. Tap to stop.");
  assert.equal(recognitions.length, 1);

  await act(async () => {
    recognitions[0].onresult?.({
      resultIndex: 0,
      results: [
        {
          0: { transcript: "hello" },
          isFinal: true
        },
        {
          0: { transcript: "there" },
          isFinal: false
        }
      ]
    });
  });

  assert.equal(renderer.getCurrent().studentInput, "Base hello there");

  await act(async () => {
    renderer.getCurrent().capture.actions.stopBrowserVoiceCapture();
  });
  assert.equal(renderer.getCurrent().capture.state.isListening, false);
  assert.equal(renderer.getCurrent().notice, "");

  await renderer.unmount();
});

test("useBrowserVoiceCaptureStrategy reports unavailable recognition support", async () => {
  const useBrowserCaptureHook = createUseBrowserVoiceCaptureStrategy({
    getSpeechRecognitionCtorImpl: () => null
  });

  const useHarness = createBrowserHarnessHook(useBrowserCaptureHook);
  const renderer = await createHookRenderer(() => useHarness());

  await act(async () => {
    renderer.getCurrent().capture.actions.startBrowserVoiceCapture();
  });

  assert.equal(renderer.getCurrent().capture.state.isListening, false);
  assert.equal(renderer.getCurrent().error, "Voice input is not available in this browser.");

  await renderer.unmount();
});
