"use client";

import { JoinSessionPanel } from "./components/JoinSessionPanel.js";
import { SessionStatusPanel } from "./components/SessionStatusPanel.js";
import { TranscriptPanel } from "./components/TranscriptPanel.js";
import { TutorComposerPanel } from "./components/TutorComposerPanel.js";
import { useChildConsole } from "./hooks/useChildConsole.js";

export default function ChildPage() {
  const { state, actions } = useChildConsole();

  return (
    <main style={{ maxWidth: 920, margin: "0 auto", padding: 20, background: "#f5fff8", minHeight: "100vh" }}>
      <h1 style={{ marginTop: 0 }}>Child Tutor Surface</h1>

      {!state.sessionAccess ? (
        <JoinSessionPanel
          joinCode={state.joinCode}
          setJoinCode={actions.setJoinCode}
          deviceFingerprint={state.deviceFingerprint}
          setDeviceFingerprint={actions.setDeviceFingerprint}
          onSubmit={actions.joinSession}
          loading={state.loading}
        />
      ) : (
        <>
          <SessionStatusPanel
            sessionAccess={state.sessionAccess}
            voiceStatus={state.voiceStatus}
            autoSpeak={state.autoSpeak}
            setAutoSpeak={actions.setAutoSpeak}
            speechSupport={state.speechSupport}
            onLeave={actions.leaveSession}
          />

          <TutorComposerPanel
            studentInput={state.studentInput}
            setStudentInput={actions.setStudentInput}
            loading={state.loading}
            voiceBusy={state.voiceBusy}
            onSend={actions.sendTurn}
            onVoiceStart={actions.startVoiceCapture}
            onVoiceStop={actions.stopVoiceCapture}
            isCloudRecording={state.isCloudRecording}
            isListening={state.isListening}
            speechSupport={state.speechSupport}
            listeningLabel={state.listeningLabel}
          />

          <TranscriptPanel messages={state.messages} />
        </>
      )}

      {state.error ? <p style={{ color: "#b42318" }}>{state.error}</p> : null}
    </main>
  );
}
