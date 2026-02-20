"use client";

import { JoinSessionPanel } from "./components/JoinSessionPanel.js";
import { SessionStatusPanel } from "./components/SessionStatusPanel.js";
import { TranscriptPanel } from "./components/TranscriptPanel.js";
import { TutorComposerPanel } from "./components/TutorComposerPanel.js";
import { StatusAlert } from "../components/feedback/StatusAlert.js";
import { useChildConsole } from "./hooks/useChildConsole.js";
import { AppShell } from "../components/layout/AppShell.js";

export default function ChildPage() {
  const { state, actions } = useChildConsole();

  return (
    <AppShell
      role="child"
      title="Hey there! 👋"
      subtitle="Type the code your parent gave you and let's get started."
    >
      <StatusAlert tone="error" message={state.error} />

      {!state.sessionAccess ? (
        <div className="console-centered">
          <JoinSessionPanel
            joinCode={state.joinCode}
            setJoinCode={actions.setJoinCode}
            deviceFingerprint={state.deviceFingerprint}
            setDeviceFingerprint={actions.setDeviceFingerprint}
            onSubmit={actions.joinSession}
            loading={state.joinLoading}
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
            loading={state.sendLoading}
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
