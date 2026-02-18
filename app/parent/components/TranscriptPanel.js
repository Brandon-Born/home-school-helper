"use client";
import { TranscriptFeed } from "../../components/transcript/TranscriptFeed.js";

export function TranscriptPanel({ activeSession, nudgeText, setNudgeText, onSendNudge, loading, nudgeAlert, messages }) {
  if (!activeSession) {
    return null;
  }

  return (
    <section className="card">
      <h2 className="section-title">Guide the session</h2>
      <p className="section-muted">Send private notes — your child won't see them.</p>

      <form onSubmit={onSendNudge} className="voice-row">
        <input
          className="input"
          placeholder="Slow down, use shorter examples"
          value={nudgeText}
          onChange={(event) => setNudgeText(event.target.value)}
        />
        <button type="submit" disabled={loading || !nudgeText.trim()} className="btn btn--primary">
          Send
        </button>
      </form>

      {nudgeAlert ? (
        <div className={`alert alert--${nudgeAlert.tone}`} style={{ marginTop: 10 }}>
          {nudgeAlert.message}
        </div>
      ) : null}

      <TranscriptFeed messages={messages} showVisibilityScope />
    </section>
  );
}
