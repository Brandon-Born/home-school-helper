"use client";

import { AuthPanel } from "./components/AuthPanel.js";
import { ChildProfilePanel } from "./components/ChildProfilePanel.js";
import { SessionControlPanel } from "./components/SessionControlPanel.js";
import { TranscriptPanel } from "./components/TranscriptPanel.js";
import { useParentConsole } from "./hooks/useParentConsole.js";
import { AppShell } from "../components/layout/AppShell.js";

export default function ParentPage() {
  const { state, actions } = useParentConsole();

  return (
    <AppShell
      role="parent"
      title="Parent Session Console"
      subtitle="Set context, start guided sessions, and steer the tutor through private nudges."
    >
      {state.error ? <div className="alert alert--error">{state.error}</div> : null}

      <div className="console-grid console-grid--parent">
        <div className="stack">
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
            <ChildProfilePanel
              childForm={state.childForm}
              setChildForm={actions.setChildForm}
              onSubmit={actions.createChild}
              loading={state.loading}
            />
          ) : null}
        </div>

        <div className="stack">
          {state.session ? (
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
          ) : null}

          {state.session ? (
            <TranscriptPanel
              activeSession={state.activeSession}
              nudgeText={state.nudgeText}
              setNudgeText={actions.setNudgeText}
              onSendNudge={actions.sendNudge}
              loading={state.loading}
              nudgeResponse={state.nudgeResponse}
              messages={state.messages}
            />
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
