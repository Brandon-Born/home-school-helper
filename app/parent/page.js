"use client";

import { useState } from "react";
import { ActiveSessionsPanel } from "./components/ActiveSessionsPanel.js";
import { AuthPanel } from "./components/AuthPanel.js";
import { ChildListPanel } from "./components/ChildListPanel.js";
import { CoppaConsentPanel } from "./components/CoppaConsentPanel.js";
import { PrivacyDataSummaryPanel } from "./components/PrivacyDataSummaryPanel.js";
import { SessionControlPanel } from "./components/SessionControlPanel.js";
import { TranscriptPanel } from "./components/TranscriptPanel.js";
import { StatusAlert } from "../components/feedback/StatusAlert.js";
import { useParentConsole } from "./hooks/useParentConsole.js";
import { AppShell } from "../components/layout/AppShell.js";
import { PARENT_CONSOLE_SECTIONS, resolveParentConsoleSection } from "./section-config.js";

export default function ParentPage() {
  const { state, actions } = useParentConsole();
  const [activeSectionId, setActiveSectionId] = useState(PARENT_CONSOLE_SECTIONS[0].id);

  const selectedChild = state.children.find((c) => c.id === state.selectedChildId) ?? null;
  const activeSection = resolveParentConsoleSection(activeSectionId);

  return (
    <AppShell
      role="parent"
      title="Your command center"
      subtitle="Set up lessons, share a code, and quietly guide the session while your child learns."
    >
      <StatusAlert tone="error" message={state.error} />

      <AuthPanel
        session={state.session}
        needsReauth={state.needsReauth}
        parentProfile={state.parentProfile}
        loading={state.loading.auth || state.loading.refreshParentData}
        onRefresh={actions.refreshParentData}
        onSignOut={actions.signOut}
        onSignIn={actions.signInWithGoogle}
      />

      {state.session ? (
        <div className="parent-workspace">
          <aside className="parent-workspace__sidebar card card--glass" aria-label="Parent console sections">
            <h2 className="section-title">Sections</h2>
            <p className="section-muted">Keep focus by working in one area at a time.</p>
            <nav className="parent-section-nav" aria-label="Parent workspace">
              {PARENT_CONSOLE_SECTIONS.map((section) => {
                const isActive = section.id === activeSection.id;
                return (
                  <button
                    key={section.id}
                    type="button"
                    className={`parent-section-nav__button${isActive ? " is-active" : ""}`}
                    data-testid={`parent-section-link-${section.id}`}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => setActiveSectionId(section.id)}
                  >
                    <span className="parent-section-nav__label">{section.label}</span>
                    <span className="parent-section-nav__description">{section.description}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <div className="parent-workspace__main stack">
            <section className="card card--glass parent-workspace__summary" aria-live="polite">
              <p className="parent-workspace__eyebrow">Now viewing</p>
              <h2 className="section-title">{activeSection.title}</h2>
              <p className="section-muted">{activeSection.description}</p>
            </section>

            {activeSection.id === "children" ? (
              <ChildListPanel
                children={state.children}
                selectedChildId={state.selectedChildId}
                setSelectedChildId={actions.setSelectedChildId}
                childForm={state.childForm}
                setChildForm={actions.setChildForm}
                onCreateChild={actions.createChild}
                onUpdateChild={actions.updateChild}
                onDeleteChild={actions.deleteChild}
                loading={state.loading.childMutation}
                actionAlert={state.actionAlerts.childMutation}
                consentGranted={state.hasCoppaConsent}
              />
            ) : null}

            {activeSection.id === "sessions" ? (
              <>
                <SessionControlPanel
                  selectedChild={selectedChild}
                  sessionForm={state.sessionForm}
                  setSessionForm={actions.setSessionForm}
                  onStartSession={actions.startSession}
                  activeSession={state.activeSession}
                  consentGranted={state.hasCoppaConsent}
                  loading={state.loading.sessionStart || state.loading.override || state.loading.sessionManage}
                  onEnableOverride={() => actions.setOverride(true)}
                  onDisableOverride={() => actions.setOverride(false)}
                  sessionStartAlert={state.actionAlerts.sessionStart}
                  overrideAlert={state.actionAlerts.override}
                />

                <ActiveSessionsPanel
                  activeSessions={state.activeSessions}
                  onRejoin={actions.rejoinSession}
                  onEnd={actions.endSession}
                  onRegenerateCode={actions.regenerateCode}
                  loading={state.loading.sessionManage}
                  actionAlert={state.actionAlerts.sessionManage}
                />

                <TranscriptPanel
                  activeSession={state.activeSession}
                  nudgeText={state.nudgeText}
                  setNudgeText={actions.setNudgeText}
                  onSendNudge={actions.sendNudge}
                  loading={state.loading.nudge}
                  nudgeAlert={state.actionAlerts.nudge}
                  messages={state.messages}
                />
              </>
            ) : null}

            {activeSection.id === "managed" ? (
              <>
                <CoppaConsentPanel
                  parentProfile={state.parentProfile}
                  consentRequired={state.coppaConsentRequired}
                  hasCoppaConsent={state.hasCoppaConsent}
                  loading={state.loading.consent}
                  actionAlert={state.actionAlerts.consent}
                  onGrantConsent={actions.grantCoppaConsent}
                  onRevokeConsent={actions.revokeCoppaConsent}
                />

                <PrivacyDataSummaryPanel
                  summary={state.privacySummary}
                  requests={state.privacyRequests}
                  loading={state.loading.privacyAction}
                  actionAlert={state.actionAlerts.privacyAction}
                  onRequestExport={actions.requestPrivacyExport}
                  onRequestDelete={actions.requestPrivacyDelete}
                />
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
