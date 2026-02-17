"use client";

export function SessionStatusPanel({
  sessionAccess,
  voiceStatus,
  turnStatus,
  autoSpeak,
  setAutoSpeak,
  speechSupport,
  onLeave
}) {
  return (
    <section className="card card--elevated">
      <h2 className="section-title">Session Status</h2>
      <p className="section-muted">
        Connected to session <code>{sessionAccess.session_id}</code>
      </p>
      <p className="section-muted">Token expires at: {sessionAccess.expires_at}</p>

      <div className="status-panel">
        <div className="status-row">
          <span className="pill">{voiceStatus}</span>
          {turnStatus ? <span className="pill">{turnStatus}</span> : null}
        </div>
      </div>

      <div className="btn-row">
        <button type="button" onClick={onLeave} className="btn btn--ghost">
          Leave Session
        </button>
        <label className="toggle">
          <input
            type="checkbox"
            checked={autoSpeak}
            onChange={(event) => setAutoSpeak(event.target.checked)}
            disabled={!speechSupport.cloudTts && !speechSupport.browserTts}
          />
          Auto-speak tutor replies
        </label>
      </div>
    </section>
  );
}
