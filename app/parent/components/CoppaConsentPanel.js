"use client";

import { useState } from "react";
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

function formatBillingStatusLabel(subscription) {
  const rawStatus = String(subscription?.status || "").trim().toLowerCase();
  if (!rawStatus) {
    return "not started";
  }

  if (subscription?.cancel_at_period_end && (rawStatus === "active" || rawStatus === "trialing")) {
    return "cancel scheduled";
  }

  return rawStatus.replaceAll("_", " ");
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
  focusMode = false,
  showRevokeAction = true
}) {
  const [showConfirmRevoke, setShowConfirmRevoke] = useState(false);

  const handleConfirmRevoke = async () => {
    await onRevokeConsent();
    setShowConfirmRevoke(false);
  };

  if (!parentProfile) {
    return null;
  }

  if (!consentRequired) {
    return null;
  }

  const consentLabel = hasCoppaConsent ? "Active" : "Required";
  const billingEnabled = Boolean(billing?.enabled);
  const billingSubscription = billing?.subscription ?? null;
  const hasSubscriptionStarted = Boolean(billingSubscription?.provider_subscription_id);
  const billingHasAccess = Boolean(billingSubscription?.has_access);
  const normalizedBillingStatus = String(billingSubscription?.status || "").trim().toLowerCase();
  const billingStatus = formatBillingStatusLabel(billingSubscription);
  const trialEndLabel = formatConsentTimestamp(billingSubscription?.trial_end_at);
  const currentPeriodEndLabel = formatConsentTimestamp(billingSubscription?.current_period_end_at);
  const trialWarningLabel = getTrialWarningLabel(billingSubscription?.trial_end_at);
  const cancelScheduled = Boolean(
    billingSubscription?.cancel_at_period_end && (normalizedBillingStatus === "active" || normalizedBillingStatus === "trialing")
  );
  const canceledWithRemainingAccess = Boolean(
    normalizedBillingStatus === "canceled" && billingHasAccess && billingSubscription?.current_period_end_at
  );
  const showActiveThroughNotice = cancelScheduled || canceledWithRemainingAccess;
  const canOpenBillingPortal = Boolean(billingEnabled && billingSubscription?.provider_customer_id && onOpenBillingPortal);
  const canStartSubscription = Boolean(
    billingEnabled &&
    hasCoppaConsent &&
    !billingHasAccess &&
    onStartBillingCheckout &&
    (!hasSubscriptionStarted || normalizedBillingStatus === "canceled")
  );
  const isCanceledResubscribe = Boolean(
    billingEnabled &&
    hasCoppaConsent &&
    hasSubscriptionStarted &&
    !billingHasAccess &&
    normalizedBillingStatus === "canceled"
  );
  const primaryActionLabel = billingEnabled && focusMode
    ? (hasCoppaConsent ? (isCanceledResubscribe ? "Restart subscription" : "Complete subscription signup") : "Start subscription for $1.99")
    : hasCoppaConsent
      ? (isCanceledResubscribe ? "Restart subscription" : "Complete subscription signup")
      : billingEnabled
        ? "Start subscription for $1.99"
        : "I am the parent or legal guardian";

  const focusStepLabel = "Subscription setup";
  const title = focusMode && billingEnabled
    ? (isCanceledResubscribe ? "Restart your subscription" : "Start for $1.99 (first month)")
    : billingEnabled && hasSubscriptionStarted
      ? "Subscription & consent"
      : "Parental consent";

  const introText = focusMode && billingEnabled
    ? hasCoppaConsent
      ? isCanceledResubscribe
        ? "Your previous subscription is no longer active. Start checkout to reactivate your family subscription."
        : "Your parent billing verification is on file. Complete checkout to activate your family subscription."
      : "Start your family subscription for $1.99 for the first month, then $9.99/month. We use the initial parent payment as part of our COPPA parental consent workflow before child profiles and tutoring sessions can begin."
    : hasCoppaConsent
      ? billingEnabled && !hasSubscriptionStarted
        ? "Parent billing verification is complete. Finish checkout to activate your family subscription."
        : "Consent is on file. New child profiles and sessions are allowed."
      : billingEnabled
        ? "COPPA parental consent is required before adding child profiles or starting new sessions. Start subscription checkout first ($1.99 for the first month, then $9.99/month)."
        : "COPPA parental consent is required before adding child profiles or starting new sessions.";

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
        <div className="card card--glass" style={{ marginTop: 16, marginBottom: 16, padding: "12px 16px" }}>
          <h3 className="section-title" style={{ fontSize: "0.9rem", marginBottom: 8 }}>Subscription details</h3>
          <div className="btn-row">
            <span className={`pill${billingSubscription?.has_access ? "" : " pill--muted"}`}>
              Status: {billingStatus || "not started"}
            </span>
            <span className="pill pill--muted">Family plan: $9.99/month</span>
          </div>

          {showActiveThroughNotice && currentPeriodEndLabel ? (
            <p
              className="section-muted"
              style={{ marginTop: 8, fontSize: "0.85rem" }}
              data-testid="billing-cancel-notice"
            >
              Your subscription is canceled and remains active until {currentPeriodEndLabel}.
            </p>
          ) : null}

          {!billingSubscription?.has_access && !hasCoppaConsent ? (
            <p className="section-muted" style={{ marginTop: 8, fontSize: "0.85rem" }}>
              Checkout completion is required before children and tutoring sessions are unlocked.
            </p>
          ) : null}

          {trialEndLabel ? (
            <p className="section-muted" style={{ marginTop: 8, fontSize: "0.85rem" }}>
              Trial ends: {trialEndLabel}.
            </p>
          ) : null}

          {currentPeriodEndLabel ? (
            <p
              className="section-muted"
              style={{ marginTop: 8, fontSize: "0.85rem" }}
              data-testid="billing-active-until"
            >
              {showActiveThroughNotice ? "Active until" : "Current period ends"}: {currentPeriodEndLabel}.
            </p>
          ) : null}

          {trialWarningLabel ? (
            <p className="section-muted" style={{ marginTop: 4, fontSize: "0.85rem" }}>
              {trialWarningLabel}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="btn-row" style={{ marginTop: 12 }}>
        {hasCoppaConsent ? (
          <>
            {canStartSubscription ? (
              <button type="button" onClick={onStartBillingCheckout} disabled={loading} className="btn btn--primary">
                {primaryActionLabel}
              </button>
            ) : null}
            {canOpenBillingPortal ? (
              <button type="button" onClick={onOpenBillingPortal} disabled={loading} className="btn btn--primary">
                Manage billing
              </button>
            ) : null}
            {showRevokeAction && !focusMode ? (
              <>
                <button type="button" onClick={() => setShowConfirmRevoke(true)} disabled={loading} className="btn btn--ghost text-destructive">
                  Revoke consent
                </button>
                {showConfirmRevoke ? (
                  <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div className="card card--elevated" style={{ padding: "24px", maxWidth: "400px", width: "95%", backgroundColor: "var(--surface-color)" }}>
                      <h3 className="section-title text-destructive" style={{ marginTop: 0 }}>Are you sure?</h3>
                      <p className="section-muted" style={{ marginBottom: 20 }}>
                        Revoking consent will block all new child profiles and sessions immediately.
                      </p>
                      <div className="btn-row" style={{ justifyContent: "flex-end" }}>
                        <button type="button" onClick={() => setShowConfirmRevoke(false)} disabled={loading} className="btn btn--ghost">
                          Cancel
                        </button>
                        <button type="button" onClick={handleConfirmRevoke} disabled={loading} className="btn btn--primary text-destructive" style={{ backgroundColor: "var(--surface-color)", border: "1px solid var(--destructive-color)" }}>
                          Yes, revoke consent
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
          </>
        ) : (
          <button type="button" onClick={onGrantConsent} disabled={loading} className="btn btn--primary">
            {primaryActionLabel}
          </button>
        )}

        <a href="/privacy" className="btn btn--secondary">
          Review privacy policy
        </a>
      </div>

      <StatusAlert tone={actionAlert?.tone} message={actionAlert?.message} style={{ marginTop: 10 }} />
    </section>
  );
}
