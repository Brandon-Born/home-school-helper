"use client";

import { useState } from "react";
import { StatusAlert } from "../../components/feedback/StatusAlert.js";

const DELETE_CONFIRM_PHRASE = "DELETE CHILD DATA";

function formatTimestamp(value) {
  if (!value) {
    return "Not available";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Not available";
  }

  return parsed.toLocaleString();
}

export function PrivacyDataSummaryPanel({
  parentProfile,
  consentRequired = true,
  hasCoppaConsent = false,
  summary,
  requests = [],
  loading,
  consentLoading = false,
  actionAlert,
  consentActionAlert,
  onRequestExport,
  onRequestDelete,
  onRevokeConsent
}) {
  const [reason, setReason] = useState("");
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [showConfirmRevoke, setShowConfirmRevoke] = useState(false);

  if (!summary && !consentRequired) {
    return null;
  }

  const hasSummary = Boolean(summary);
  const counts = summary?.counts ?? {};
  const windows = summary?.windows ?? {};
  const retention = summary?.retention ?? {};
  const categories = Array.isArray(summary?.categories) ? summary.categories : [];
  const latestRequests = Array.isArray(requests) ? requests.slice(0, 5) : [];
  const consentUpdatedAtLabel = formatTimestamp(parentProfile?.coppa_consent_updated_at);
  const policyVersion = parentProfile?.coppa_policy_version || "2026-02-19";

  const handleRequestExport = async () => {
    await onRequestExport?.({ reason });
  };

  const handleRequestDelete = async () => {
    await onRequestDelete?.({ reason, confirmPhrase });
  };

  const handleConfirmRevoke = async () => {
    const ok = await onRevokeConsent?.();
    if (ok !== false) {
      setShowConfirmRevoke(false);
    }
  };

  return (
    <section className="card" aria-busy={loading || consentLoading}>
      <h2 className="section-title">Child data summary</h2>
      <p className="section-muted">
        Review collected child-data categories, request export or deletion, and manage parental consent for future collection.
      </p>

      {consentRequired ? (
        <div className="card card--glass" style={{ marginTop: 12, padding: "12px 16px" }}>
          <div className="consent-panel__header" style={{ marginBottom: 8 }}>
            <h3 className="section-title" style={{ fontSize: "1rem", marginBottom: 0 }}>
              Parental consent (COPPA)
            </h3>
            <span className={`pill${hasCoppaConsent ? "" : " pill--muted"}`}>
              {hasCoppaConsent ? "Active" : "Not active"}
            </span>
          </div>
          <p className="section-muted" style={{ margin: 0 }}>
            Withdrawing parental consent blocks new child profiles and new tutoring sessions. This does not automatically cancel your subscription billing.
          </p>
          <p className="section-muted" style={{ marginTop: 8, fontSize: "0.85rem" }}>
            Policy version: {policyVersion}
            {consentUpdatedAtLabel ? ` · Last updated: ${consentUpdatedAtLabel}` : ""}
          </p>
          {hasCoppaConsent ? (
            <div className="btn-row" style={{ marginTop: 10 }}>
              <button
                type="button"
                onClick={() => setShowConfirmRevoke(true)}
                disabled={consentLoading}
                className="btn btn--ghost text-destructive"
              >
                Withdraw parental consent (COPPA)
              </button>
            </div>
          ) : (
            <p className="section-muted" style={{ marginTop: 10 }}>
              Parental consent is not active. Child profile creation and new sessions are blocked.
            </p>
          )}

          {showConfirmRevoke ? (
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div className="card card--elevated" style={{ padding: "24px", maxWidth: "440px", width: "95%", backgroundColor: "var(--surface-color)" }}>
                <h3 className="section-title text-destructive" style={{ marginTop: 0 }}>
                  Withdraw parental consent?
                </h3>
                <p className="section-muted" style={{ marginBottom: 12 }}>
                  This immediately blocks new child profiles and new tutoring sessions.
                </p>
                <p className="section-muted" style={{ marginBottom: 20 }}>
                  Your subscription billing is not canceled automatically. Use Billing & Account to manage billing.
                </p>
                <div className="btn-row" style={{ justifyContent: "flex-end" }}>
                  <button type="button" onClick={() => setShowConfirmRevoke(false)} disabled={consentLoading} className="btn btn--ghost">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmRevoke}
                    disabled={consentLoading}
                    className="btn btn--primary text-destructive"
                    style={{ backgroundColor: "var(--surface-color)", border: "1px solid var(--destructive-color)" }}
                  >
                    Yes, withdraw consent
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <StatusAlert tone={consentActionAlert?.tone} message={consentActionAlert?.message} style={{ marginTop: 10 }} />
        </div>
      ) : null}

      {hasSummary ? (
        <>
          <p className="section-muted" style={{ marginTop: 12 }}>
            Snapshot generated {formatTimestamp(summary.generated_at)}. Raw audio storage:{" "}
            {retention.raw_audio_stored ? "enabled" : "disabled"}.
          </p>
          <p className="section-muted" style={{ marginTop: 6 }}>
            Transcript retention: {retention.transcript_days ?? 30} days.
          </p>

          <div className="privacy-summary-grid">
            <div className="privacy-summary-item">
              <span className="privacy-summary-item__label">Children</span>
              <strong className="privacy-summary-item__value">{counts.children ?? 0}</strong>
            </div>
            <div className="privacy-summary-item">
              <span className="privacy-summary-item__label">Sessions</span>
              <strong className="privacy-summary-item__value">{counts.sessions ?? 0}</strong>
            </div>
            <div className="privacy-summary-item">
              <span className="privacy-summary-item__label">Transcript messages</span>
              <strong className="privacy-summary-item__value">{counts.transcript_messages ?? 0}</strong>
            </div>
            <div className="privacy-summary-item">
              <span className="privacy-summary-item__label">Parent-only messages</span>
              <strong className="privacy-summary-item__value">{counts.parent_only_messages ?? 0}</strong>
            </div>
          </div>

          {categories.length > 0 ? (
            <p className="section-muted" style={{ marginTop: 8 }}>
              Categories: {categories.join(", ")}.
            </p>
          ) : null}

          <p className="section-muted" style={{ marginTop: 8 }}>
            Message window: {formatTimestamp(windows.first_message_created_at)} to{" "}
            {formatTimestamp(windows.last_message_created_at)}.
          </p>
        </>
      ) : (
        <p className="section-muted" style={{ marginTop: 12 }}>
          Child-data summary is temporarily unavailable.
        </p>
      )}

      <div className="form-grid" style={{ marginTop: 12 }}>
        <label className="field">
          <span className="label">Reason (optional)</span>
          <textarea
            className="textarea"
            rows={2}
            placeholder="Reason for export/delete request"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>

        <div className="btn-row">
          <button type="button" className="btn btn--secondary" disabled={loading} onClick={handleRequestExport}>
            Request export snapshot
          </button>
        </div>

        <label className="field">
          <span className="label">Type "{DELETE_CONFIRM_PHRASE}" to confirm deletion</span>
          <input
            className="input"
            value={confirmPhrase}
            onChange={(event) => setConfirmPhrase(event.target.value)}
            placeholder={DELETE_CONFIRM_PHRASE}
          />
        </label>

        <div className="btn-row">
          <button
            type="button"
            className="btn btn--danger"
            disabled={loading || String(confirmPhrase).trim().toUpperCase() !== DELETE_CONFIRM_PHRASE}
            onClick={handleRequestDelete}
          >
            Delete all child data
          </button>
        </div>
      </div>

      <StatusAlert tone={actionAlert?.tone} message={actionAlert?.message} style={{ marginTop: 10 }} />

      <div style={{ marginTop: 12 }}>
        <h3 className="section-title" style={{ fontSize: "1rem", marginBottom: 6 }}>
          Recent privacy requests
        </h3>
        {latestRequests.length === 0 ? (
          <p className="section-muted">No requests yet.</p>
        ) : (
          <div className="privacy-request-list">
            {latestRequests.map((request) => (
              <div className="privacy-request-item" key={request.id}>
                <span className="privacy-request-item__type">{request.request_type}</span>
                <span className="privacy-request-item__status">{request.status}</span>
                <span className="privacy-request-item__time">{formatTimestamp(request.requested_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
