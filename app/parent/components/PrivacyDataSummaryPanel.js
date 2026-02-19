"use client";

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

export function PrivacyDataSummaryPanel({ summary }) {
  if (!summary) {
    return null;
  }

  const counts = summary.counts ?? {};
  const windows = summary.windows ?? {};
  const retention = summary.retention ?? {};
  const categories = Array.isArray(summary.categories) ? summary.categories : [];

  return (
    <section className="card">
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
    </section>
  );
}
