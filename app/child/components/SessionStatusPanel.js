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
    <div className="child-session-bar" aria-live="polite">
      <div className="status-row">
        <span className="pill">{voiceStatus}</span>
        {turnStatus ? <span className="pill">{turnStatus}</span> : null}
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
        <button type="button" onClick={onLeave} className="btn btn--ghost btn--sm">
          Leave
        </button>
      </div>
    </div>
  );
}
