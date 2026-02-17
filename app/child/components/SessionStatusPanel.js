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
      <h2 className="section-title">Lesson Status</h2>
      <p className="section-muted">
        You are connected to your lesson.
      </p>
      <p className="section-muted">Access expires at: {sessionAccess.expires_at}</p>
      <p className="section-muted">
        Session ID (for support): <code>{sessionAccess.session_id}</code>
      </p>

      <div className="status-panel">
        <div className="status-row">
          <span className="pill">{voiceStatus}</span>
          {turnStatus ? <span className="pill">{turnStatus}</span> : null}
        </div>
      </div>

      <div className="btn-row">
        <button type="button" onClick={onLeave} className="btn btn--ghost">
          Leave Lesson
        </button>
        <label className="toggle">
          <input
            type="checkbox"
            checked={autoSpeak}
            onChange={(event) => setAutoSpeak(event.target.checked)}
            disabled={!speechSupport.cloudTts && !speechSupport.browserTts}
          />
          Read tutor replies out loud
        </label>
      </div>
    </section>
  );
}
