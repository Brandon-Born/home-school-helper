"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  const [hasAutoSelected, setHasAutoSelected] = useState(false);

  const displaySections = useMemo(() => {
    if (state.children.length > 0) {
      const childrenSection = PARENT_CONSOLE_SECTIONS.find((s) => s.id === "children");
      const sessionsSection = PARENT_CONSOLE_SECTIONS.find((s) => s.id === "sessions");
      const managedSection = PARENT_CONSOLE_SECTIONS.find((s) => s.id === "managed");
      return [sessionsSection, childrenSection, managedSection].filter(Boolean);
    }
    return PARENT_CONSOLE_SECTIONS;
  }, [state.children.length]);

  useEffect(() => {
    if (state.parentProfile && !state.loading.refreshParentData && !hasAutoSelected) {
      // If there are live sessions, or if we have children and session tab is now first, default to session tab
      if (state.activeSessions.length > 0 || state.children.length > 0) {
        setActiveSectionId("sessions");
      }
      setHasAutoSelected(true);
    }
  }, [state.parentProfile, state.loading.refreshParentData, hasAutoSelected, state.activeSessions.length, state.children.length]);

  const switchSection = useCallback((id) => {
    // A manual section selection should not be overridden by a later auto-select pass.
    setHasAutoSelected(true);
    setActiveSectionId(id);
    if (id === "sessions") {
      actions.setSelectedChildId("");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [actions]);

  const selectedChild = state.children.find((c) => c.id === state.selectedChildId) ?? null;
  const activeSection = resolveParentConsoleSection(activeSectionId);
  const showInitialWorkspaceLoading = Boolean(state.session) && !state.parentDataLoaded;
  const hasBillingSubscriptionStarted = Boolean(state.billingSubscription?.provider_subscription_id);
  const showTrialSetupOnboarding = Boolean(
    state.session &&
      state.billingEnabled &&
      state.coppaConsentRequired &&
      !showInitialWorkspaceLoading &&
      !state.billingHasAccess &&
      (!state.hasCoppaConsent || !hasBillingSubscriptionStarted)
  );
  const shellTitle = showTrialSetupOnboarding ? "Start your family trial" : "Your command center";
  const shellSubtitle = showTrialSetupOnboarding
    ? "Complete two quick steps to unlock child profiles and tutoring sessions."
    : "Set up sessions, share a code, and quietly guide the session while your child learns.";

  return (
    <AppShell
      role="parent"
      title={shellTitle}
      subtitle={shellSubtitle}
    >
      <StatusAlert tone="error" message={state.error} />

      <AuthPanel
        session={state.session}
        needsReauth={state.needsReauth}
        parentProfile={state.parentProfile}
        loading={state.loading.auth || state.loading.refreshParentData || showInitialWorkspaceLoading}
        onRefresh={actions.refreshParentData}
        onSignOut={actions.signOut}
        onSignIn={actions.signInWithGoogle}
      />

      {state.session ? (
        showInitialWorkspaceLoading ? (
          <div className="parent-workspace parent-workspace--loading" data-testid="parent-workspace-loading" aria-busy="true">
            <aside className="parent-workspace__sidebar card card--glass" aria-label="Parent console sections">
              <nav className="parent-section-nav" aria-label="Parent workspace">
                {displaySections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    className="parent-section-nav__button parent-section-nav__button--loading"
                    data-testid={`parent-section-link-${section.id}`}
                    disabled
                    aria-disabled="true"
                  >
                    {section.label}
                  </button>
                ))}
              </nav>
            </aside>

            <div className="parent-workspace__main stack">
              <section className="card card--glass parent-workspace__summary parent-loading-panel parent-loading-panel--hero" aria-live="polite" aria-busy="true">
                <p className="sr-only" role="status">Loading parent workspace data.</p>
                <p className="parent-workspace__eyebrow parent-loading-panel__eyebrow">Loading</p>
                <h2 className="section-title">Getting your parent workspace ready…</h2>
                <p className="section-muted">Fetching children, active sessions, and privacy details.</p>
                <div className="parent-loading-stack" aria-hidden="true">
                  <span className="parent-skeleton-line parent-skeleton-line--md" />
                  <span className="parent-skeleton-line parent-skeleton-line--lg" />
                  <span className="parent-skeleton-line parent-skeleton-line--sm" />
                </div>
              </section>

              <section className="card parent-loading-panel" aria-live="polite" aria-busy="true">
                <h2 className="section-title">Loading your data</h2>
                <p className="section-muted">This replaces the empty-state view until the first parent data request finishes.</p>
                <div className="parent-loading-card-grid" aria-hidden="true">
                  <div className="parent-loading-card-grid__row">
                    <span className="parent-skeleton-dot" />
                    <div className="parent-loading-stack" style={{ margin: 0 }}>
                      <span className="parent-skeleton-line parent-skeleton-line--md" />
                      <span className="parent-skeleton-line parent-skeleton-line--xl" />
                    </div>
                    <span className="parent-skeleton-pill" />
                  </div>
                  <div className="parent-loading-card-grid__row">
                    <span className="parent-skeleton-dot" />
                    <div className="parent-loading-stack" style={{ margin: 0 }}>
                      <span className="parent-skeleton-line parent-skeleton-line--sm" />
                      <span className="parent-skeleton-line parent-skeleton-line--lg" />
                    </div>
                    <span className="parent-skeleton-pill parent-skeleton-pill--muted" />
                  </div>
                  <div className="parent-loading-card-grid__row">
                    <span className="parent-skeleton-dot" />
                    <div className="parent-loading-stack" style={{ margin: 0 }}>
                      <span className="parent-skeleton-line parent-skeleton-line--md" />
                      <span className="parent-skeleton-line parent-skeleton-line--md" />
                    </div>
                    <span className="parent-skeleton-pill" />
                  </div>
                </div>
              </section>
            </div>
          </div>
        ) : showTrialSetupOnboarding ? (
          <div className="stack" data-testid="parent-trial-onboarding">
            <section className="card card--glass parent-workspace__summary" aria-live="polite">
              <p className="parent-workspace__eyebrow">Get started</p>
              <h2 className="section-title">Start your 7-day family trial</h2>
              <p className="section-muted">
                We will walk you through two steps: verify a parent payment method, then complete trial checkout.
                After that, you can add children and start tutoring sessions.
              </p>
            </section>

            <CoppaConsentPanel
              parentProfile={state.parentProfile}
              consentRequired={state.coppaConsentRequired}
              hasCoppaConsent={state.hasCoppaConsent}
              billing={state.billing}
              loading={state.loading.consent}
              actionAlert={state.actionAlerts.consent}
              onGrantConsent={actions.grantCoppaConsent}
              onStartBillingCheckout={actions.startBillingCheckout}
              onOpenBillingPortal={actions.openBillingPortal}
              onRevokeConsent={actions.revokeCoppaConsent}
              focusMode
            />

            <section className="card" aria-label="What happens next">
              <h3 className="section-title" style={{ fontSize: "1.05rem" }}>What happens next</h3>
              <div className="stack" style={{ gap: 10 }}>
                <p className="section-muted" style={{ margin: 0 }}>
                  1. Verify a parent payment method (small temporary authorization or refundable verification charge).
                </p>
                <p className="section-muted" style={{ margin: 0 }}>
                  2. Start your 7-day free trial and unlock your family workspace.
                </p>
                <p className="section-muted" style={{ margin: 0 }}>
                  3. Add children and begin tutoring sessions.
                </p>
              </div>
            </section>
          </div>
        ) : (
          <div className="parent-workspace">
            <aside className="parent-workspace__sidebar card card--glass" aria-label="Parent console sections">
              <nav className="parent-section-nav" aria-label="Parent workspace">
                {displaySections.map((section) => {
                  const isActive = section.id === activeSection.id;
                  return (
                    <button
                      key={section.id}
                      type="button"
                      className={`parent-section-nav__button${isActive ? " is-active" : ""}`}
                      data-testid={`parent-section-link-${section.id}`}
                      aria-current={isActive ? "page" : undefined}
                      onClick={() => switchSection(section.id)}
                    >
                      {section.label}
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
                  billingEnabled={state.billingEnabled}
                  onGrantConsent={actions.grantCoppaConsent}
                  consentLoading={state.loading.consent}
                  consentAlert={state.actionAlerts.consent}
                />
              ) : null}

              {activeSection.id === "sessions" ? (
                <>
                  <ActiveSessionsPanel
                    children={state.children}
                    activeSessions={state.activeSessions}
                    selectedChildId={state.selectedChildId}
                    onSelectChild={actions.setSelectedChildId}
                    onRejoin={actions.rejoinSession}
                    onEnd={actions.endSession}
                    onRegenerateCode={actions.regenerateCode}
                    loading={state.loading.sessionManage}
                    actionAlert={state.actionAlerts.sessionManage}
                  />

                  {selectedChild ? (
                    <>
                      <SessionControlPanel
                        selectedChild={selectedChild}
                        billingEnabled={state.billingEnabled}
                        billingHasAccess={state.billingHasAccess}
                        billingStatus={state.billingSubscription?.status ?? ""}
                        billingTrialEndsAt={state.billingSubscription?.trial_end_at ?? null}
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
                </>
              ) : null}

              {activeSection.id === "managed" ? (
                <>
                  <CoppaConsentPanel
                    parentProfile={state.parentProfile}
                    consentRequired={state.coppaConsentRequired}
                    hasCoppaConsent={state.hasCoppaConsent}
                    billing={state.billing}
                    loading={state.loading.consent}
                    actionAlert={state.actionAlerts.consent}
                    onGrantConsent={actions.grantCoppaConsent}
                    onStartBillingCheckout={actions.startBillingCheckout}
                    onOpenBillingPortal={actions.openBillingPortal}
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
        )
      ) : null}
    </AppShell>
  );
}
