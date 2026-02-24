"use client";

import { StatusAlert } from "../../components/feedback/StatusAlert.js";

function formatConsentTimestamp(value) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toLocaleString();
}

function getTrialWarningLabel(trialEndAt) {
  if (!trialEndAt) {
    return "";
  }

  const trialEnd = new Date(trialEndAt);
  if (Number.isNaN(trialEnd.getTime())) {
    return "";
  }

  const diffMs = trialEnd.getTime() - Date.now();
  const daysLeft = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  if (daysLeft < 0) {
    return "Trial has ended.";
  }
  if (daysLeft <= 2) {
    return `Trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`;
  }

  return "";
}

export function CoppaConsentPanel({
  parentProfile,
  consentRequired,
  hasCoppaConsent,
  billing,
  loading,
  actionAlert,
  onGrantConsent,
  onStartBillingCheckout,
  onOpenBillingPortal,
  onRevokeConsent,
  focusMode = false
}) {
  if (!parentProfile) {
    return null;
  }

  if (!consentRequired) {
    return null;
  }

  const consentLabel = hasCoppaConsent ? "Active" : "Required";
  const updatedAtLabel = formatConsentTimestamp(parentProfile.coppa_consent_updated_at);
  const policyVersion = parentProfile.coppa_policy_version || "2026-02-19";
  const billingEnabled = Boolean(billing?.enabled);
  const billingSubscription = billing?.subscription ?? null;
  const hasSubscriptionStarted = Boolean(billingSubscription?.provider_subscription_id);
  const billingStatus = billingSubscription?.status ? String(billingSubscription.status).replaceAll("_", " ") : "";
  const trialEndLabel = formatConsentTimestamp(billingSubscription?.trial_end_at);
  const trialWarningLabel = getTrialWarningLabel(billingSubscription?.trial_end_at);
  const canOpenBillingPortal = Boolean(billingEnabled && billingSubscription?.provider_customer_id && onOpenBillingPortal);
  const canStartSubscription = Boolean(billingEnabled && hasCoppaConsent && !hasSubscriptionStarted && onStartBillingCheckout);
  const primaryActionLabel = billingEnabled && focusMode
    ? (hasCoppaConsent ? "Complete subscription signup" : "Start subscription for $1.99")
    : hasCoppaConsent
      ? "Complete subscription signup"
      : billingEnabled
        ? "Start subscription for $1.99"
        : "I am the parent or legal guardian";
  const focusStepLabel = "Subscription setup";
  const title = focusMode && billingEnabled ? "Start for $1.99 (first month)" : "Parental consent";
  const introText = focusMode && billingEnabled
    ? hasCoppaConsent
      ? "Your parent billing verification is on file. Complete checkout to activate your family subscription."
      : "Start your family subscription for $1.99 for the first month, then $9.99/month."
    : hasCoppaConsent
      ? billingEnabled && !hasSubscriptionStarted
        ? "Parent billing verification is complete. Finish checkout to activate your family subscription."
        : "Consent is on file. New child profiles and sessions are allowed."
      : billingEnabled
        ? "COPPA parental consent is required before adding child profiles or starting new sessions. Start subscription checkout first ($1.99 for the first month, then $9.99/month)."
        : "COPPA parental consent is required before adding child profiles or starting new sessions.";
  const secondaryCoppaText = focusMode && billingEnabled
    ? "We use the initial parent subscription payment as part of our COPPA parental consent workflow before child profiles and tutoring sessions can begin."
    : "";

  return (
    <section
      className={`card ${hasCoppaConsent ? "card--accent" : "card--elevated"}`}
      aria-busy={loading}
      data-testid={focusMode ? "parent-trial-setup-card" : undefined}
    >
      <div className="consent-panel__header">
        <h2 className="section-title">{title}</h2>
        <span className={`pill${hasCoppaConsent ? "" : " pill--muted"}`}>
          {focusMode && billingEnabled ? focusStepLabel : consentLabel}
        </span>
      </div>

      <p className="section-muted">
        {introText}
      </p>

      {billingEnabled ? (
        <>
          <div className="btn-row" style={{ marginTop: 4 }}>
            <span className={`pill${billingSubscription?.has_access ? "" : " pill--muted"}`}>
              Billing: {billingStatus || "not started"}
            </span>
            <span className="pill pill--muted">Family plan: $9.99/month</span>
          </div>
          <p className="section-muted" style={{ marginTop: 8 }}>
            $1.99 for the first month, then $9.99/month.
            {!hasCoppaConsent ? " Checkout completion is required before children and tutoring sessions are unlocked." : ""}
            {trialEndLabel ? ` Trial ends: ${trialEndLabel}.` : ""}
          </p>
          {trialWarningLabel ? (
            <p className="section-muted" style={{ marginTop: 4 }}>
              {trialWarningLabel}
            </p>
          ) : null}
          {secondaryCoppaText ? (
            <p className="section-muted" style={{ marginTop: 8 }}>
              {secondaryCoppaText}
            </p>
          ) : null}
        </>
      ) : null}

      <p className="section-muted consent-panel__meta">
        Policy version: {policyVersion}
        {updatedAtLabel ? ` · Last updated: ${updatedAtLabel}` : ""}
      </p>

      <div className="btn-row" style={{ marginTop: 10 }}>
        {hasCoppaConsent ? (
          <>
            {canStartSubscription ? (
              <button type="button" onClick={onStartBillingCheckout} disabled={loading} className="btn btn--primary">
                {primaryActionLabel}
              </button>
            ) : null}
            {!focusMode ? (
              <button type="button" onClick={onRevokeConsent} disabled={loading} className="btn btn--ghost">
                Revoke consent
              </button>
            ) : null}
          </>
        ) : (
          <button type="button" onClick={onGrantConsent} disabled={loading} className="btn btn--primary">
            {primaryActionLabel}
          </button>
        )}

        {canOpenBillingPortal ? (
          <button type="button" onClick={onOpenBillingPortal} disabled={loading} className="btn btn--secondary">
            Manage billing
          </button>
        ) : null}

        <a href="/privacy" className="btn btn--secondary">
          Review privacy policy
        </a>
      </div>

      <StatusAlert tone={actionAlert?.tone} message={actionAlert?.message} style={{ marginTop: 10 }} />
    </section>
  );
}
