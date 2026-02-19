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
    <section className="card card--accent" aria-live="polite">
      <h2 className="section-title">You're in! ✅</h2>
      <p className="section-muted">
        Your lesson is ready. Ask questions below!
      </p>

      <div className="status-panel" role="status" aria-live="polite" aria-atomic="true">
        <div className="status-row">
          <span className="pill">{voiceStatus}</span>
          {turnStatus ? <span className="pill">{turnStatus}</span> : null}
        </div>
      </div>

      <div className="btn-row">
        <label className="toggle" htmlFor="auto-speak-toggle">
          <input
            id="auto-speak-toggle"
            type="checkbox"
            checked={autoSpeak}
            onChange={(event) => setAutoSpeak(event.target.checked)}
            disabled={!speechSupport.cloudTts && !speechSupport.browserTts}
          />
          Read answers out loud
        </label>
        <button type="button" onClick={onLeave} className="btn btn--ghost">
          Leave lesson
        </button>
      </div>
    </section>
  );
}
