"use client";

import { AuthPanel } from "./components/AuthPanel.js";
import { ChildProfilePanel } from "./components/ChildProfilePanel.js";
import { SessionControlPanel } from "./components/SessionControlPanel.js";
import { TranscriptPanel } from "./components/TranscriptPanel.js";
import { useParentConsole } from "./hooks/useParentConsole.js";

export default function ParentPage() {
  const { state, actions } = useParentConsole();

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: 20, background: "#f6f7fb", minHeight: "100vh" }}>
      <h1 style={{ marginTop: 0 }}>Parent Session Console</h1>

      <AuthPanel
        session={state.session}
        needsReauth={state.needsReauth}
        parentProfile={state.parentProfile}
        loading={state.loading}
        onRefresh={actions.refreshParentData}
        onSignOut={actions.signOut}
        onSignIn={actions.signInWithGoogle}
      />

      {state.session ? (
        <>
          <ChildProfilePanel
            childForm={state.childForm}
            setChildForm={actions.setChildForm}
            onSubmit={actions.createChild}
            loading={state.loading}
          />

          <SessionControlPanel
            children={state.children}
            selectedChildId={state.selectedChildId}
            setSelectedChildId={actions.setSelectedChildId}
            sessionForm={state.sessionForm}
            setSessionForm={actions.setSessionForm}
            onStartSession={actions.startSession}
            activeSession={state.activeSession}
            loading={state.loading}
            onEnableOverride={() => actions.setOverride(true)}
            onDisableOverride={() => actions.setOverride(false)}
          />

          <TranscriptPanel
            activeSession={state.activeSession}
            nudgeText={state.nudgeText}
            setNudgeText={actions.setNudgeText}
            onSendNudge={actions.sendNudge}
            loading={state.loading}
            nudgeResponse={state.nudgeResponse}
            messages={state.messages}
          />
        </>
      ) : null}

      {state.error ? <p style={{ color: "#b42318" }}>{state.error}</p> : null}
    </main>
  );
}
