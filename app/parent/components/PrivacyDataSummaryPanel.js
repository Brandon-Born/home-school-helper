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
  summary,
  requests = [],
  loading,
  actionAlert,
  onRequestExport,
  onRequestDelete
}) {
  const [reason, setReason] = useState("");
  const [confirmPhrase, setConfirmPhrase] = useState("");

  if (!summary) {
    return null;
  }

  const counts = summary.counts ?? {};
  const windows = summary.windows ?? {};
  const retention = summary.retention ?? {};
  const categories = Array.isArray(summary.categories) ? summary.categories : [];
  const latestRequests = Array.isArray(requests) ? requests.slice(0, 5) : [];

  const handleRequestExport = async () => {
    await onRequestExport?.({ reason });
  };

  const handleRequestDelete = async () => {
    await onRequestDelete?.({ reason, confirmPhrase });
  };

  return (
    <section className="card" aria-busy={loading}>
      <h2 className="section-title">Child data summary</h2>
      <p className="section-muted">
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
