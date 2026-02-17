"use client";

import { JoinSessionPanel } from "./components/JoinSessionPanel.js";
import { SessionStatusPanel } from "./components/SessionStatusPanel.js";
import { TranscriptPanel } from "./components/TranscriptPanel.js";
import { TutorComposerPanel } from "./components/TutorComposerPanel.js";
import { useChildConsole } from "./hooks/useChildConsole.js";
import { AppShell } from "../components/layout/AppShell.js";

export default function ChildPage() {
  const { state, actions } = useChildConsole();

  return (
    <AppShell
      role="child"
      title="Child Screen"
      subtitle="Enter your session code, ask questions by voice or text, and get step-by-step help."
    >
      {state.error ? <div className="alert alert--error">{state.error}</div> : null}

      {!state.sessionAccess ? (
        <div className="console-centered">
          <JoinSessionPanel
            joinCode={state.joinCode}
            setJoinCode={actions.setJoinCode}
            deviceFingerprint={state.deviceFingerprint}
            setDeviceFingerprint={actions.setDeviceFingerprint}
            onSubmit={actions.joinSession}
            loading={state.loading}
          />
        </div>
      ) : (
        <div className="stack">
          <SessionStatusPanel
            sessionAccess={state.sessionAccess}
            voiceStatus={state.voiceStatus}
            turnStatus={state.turnStatus}
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
            isTranscribing={state.isTranscribing}
            isPlayingSpeech={state.isPlayingSpeech}
            pendingTutorReply={state.pendingTutorReply}
            turnStatus={state.turnStatus}
            onSend={actions.sendTurn}
            onVoiceStart={actions.startVoiceCapture}
            onVoiceStop={actions.stopVoiceCapture}
            isCloudRecording={state.isCloudRecording}
            isListening={state.isListening}
            speechSupport={state.speechSupport}
            listeningLabel={state.listeningLabel}
          />

          <TranscriptPanel messages={state.messages} pendingTutorReply={state.pendingTutorReply} />
        </div>
      )}
    </AppShell>
  );
}
