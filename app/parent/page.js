"use client";

import { AuthPanel } from "./components/AuthPanel.js";
import { ChildListPanel } from "./components/ChildListPanel.js";
import { SessionControlPanel } from "./components/SessionControlPanel.js";
import { TranscriptPanel } from "./components/TranscriptPanel.js";
import { useParentConsole } from "./hooks/useParentConsole.js";
import { AppShell } from "../components/layout/AppShell.js";

export default function ParentPage() {
  const { state, actions } = useParentConsole();

  const selectedChild = state.children.find((c) => c.id === state.selectedChildId) ?? null;

  return (
    <AppShell
      role="parent"
      title="Your command center"
      subtitle="Set up lessons, share a code, and quietly guide the tutor while your child learns."
    >
      {state.error ? <div className="alert alert--error">{state.error}</div> : null}

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
        <div className="console-grid console-grid--parent">
          <div className="stack">
            <ChildListPanel
              children={state.children}
              selectedChildId={state.selectedChildId}
              setSelectedChildId={actions.setSelectedChildId}
              childForm={state.childForm}
              setChildForm={actions.setChildForm}
              onCreateChild={actions.createChild}
              onUpdateChild={actions.updateChild}
              onDeleteChild={actions.deleteChild}
              loading={state.loading}
            />
          </div>

          <div className="stack">
            <SessionControlPanel
              selectedChild={selectedChild}
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
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
