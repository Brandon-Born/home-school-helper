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
  const canStartFreeTrial = Boolean(billingEnabled && hasCoppaConsent && !hasSubscriptionStarted && onStartBillingCheckout);
  const primaryActionLabel = billingEnabled && focusMode
    ? "Start your free trial"
    : hasCoppaConsent
      ? "Start free week"
      : billingEnabled
        ? "Verify parent payment method"
        : "I am the parent or legal guardian";
  const focusStepLabel = !hasCoppaConsent ? "Step 1 of 2: Verify parent payment method" : "Step 2 of 2: Start your free trial";
  const title = focusMode && billingEnabled ? "Start your 7-day free trial" : "Parental consent";
  const introText = focusMode && billingEnabled
    ? hasCoppaConsent
      ? "Your parent verification is complete. Finish checkout to start your 7-day family trial."
      : "Start your 7-day family trial. First, we verify a parent payment method, then you will complete trial checkout."
    : hasCoppaConsent
      ? billingEnabled && !hasSubscriptionStarted
        ? "Parent verification is complete. Start your 7-day family trial to activate your family subscription."
        : "Consent is on file. New child profiles and sessions are allowed."
      : billingEnabled
        ? "COPPA parental consent is required before adding child profiles or starting new sessions. Verify a parent payment method first (you may see a $1.00 temporary authorization or refundable verification charge), then start your 7-day family trial."
        : "COPPA parental consent is required before adding child profiles or starting new sessions.";
  const secondaryCoppaText = focusMode && billingEnabled
    ? "We use parent payment-method verification (you may see a $1.00 temporary authorization or refundable verification charge) as part of our COPPA parental consent workflow before child profiles and tutoring sessions can begin."
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
            <span className="pill pill--muted">Family plan: $10/month</span>
          </div>
          <p className="section-muted" style={{ marginTop: 8 }}>
            7-day free trial before monthly billing.
            {!hasCoppaConsent ? " The free trial starts after parent payment verification succeeds." : ""}
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
            {canStartFreeTrial ? (
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
