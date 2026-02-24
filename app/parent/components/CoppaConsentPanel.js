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

export function CoppaConsentPanel({
  parentProfile,
  consentRequired,
  hasCoppaConsent,
  billing,
  loading,
  actionAlert,
  onGrantConsent,
  onOpenBillingPortal,
  onRevokeConsent
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
  const billingStatus = billingSubscription?.status ? String(billingSubscription.status).replaceAll("_", " ") : "";
  const trialEndLabel = formatConsentTimestamp(billingSubscription?.trial_end_at);
  const canOpenBillingPortal = Boolean(billingEnabled && billingSubscription?.provider_customer_id && onOpenBillingPortal);

  return (
    <section className={`card ${hasCoppaConsent ? "card--accent" : "card--elevated"}`} aria-busy={loading}>
      <div className="consent-panel__header">
        <h2 className="section-title">Parental consent</h2>
        <span className={`pill${hasCoppaConsent ? "" : " pill--muted"}`}>{consentLabel}</span>
      </div>

      <p className="section-muted">
        {hasCoppaConsent
          ? "Consent is on file. New child profiles and sessions are allowed."
          : billingEnabled
            ? "COPPA parental consent is required before adding child profiles or starting new sessions. Start your 7-day family trial to verify a parent payment method."
            : "COPPA parental consent is required before adding child profiles or starting new sessions."}
      </p>

      {billingEnabled ? (
        <p className="section-muted" style={{ marginTop: 4 }}>
          Family plan: 7-day free trial, then $10/month.
          {billingStatus ? ` Billing status: ${billingStatus}.` : ""}
          {trialEndLabel ? ` Trial ends: ${trialEndLabel}.` : ""}
        </p>
      ) : null}

      <p className="section-muted consent-panel__meta">
        Policy version: {policyVersion}
        {updatedAtLabel ? ` · Last updated: ${updatedAtLabel}` : ""}
      </p>

      <div className="btn-row" style={{ marginTop: 10 }}>
        {hasCoppaConsent ? (
          <button type="button" onClick={onRevokeConsent} disabled={loading} className="btn btn--ghost">
            Revoke consent
          </button>
        ) : (
          <button type="button" onClick={onGrantConsent} disabled={loading} className="btn btn--primary">
            {billingEnabled ? "Start free week" : "I am the parent or legal guardian"}
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
