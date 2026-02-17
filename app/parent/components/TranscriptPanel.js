"use client";
import { TranscriptFeed } from "../../components/transcript/TranscriptFeed.js";

export function TranscriptPanel({ activeSession, nudgeText, setNudgeText, onSendNudge, loading, nudgeResponse, messages }) {
  if (!activeSession) {
    return null;
  }

  return (
    <section className="card">
      <h2 className="section-title">Private Notes + Live Transcript</h2>
      <p className="section-muted">Private notes guide the tutor and are not shown to your child.</p>

      <form onSubmit={onSendNudge} className="voice-row">
        <input
          className="input"
          placeholder="Example: Slow down and use one short example."
          value={nudgeText}
          onChange={(event) => setNudgeText(event.target.value)}
        />
        <button type="submit" disabled={loading || !nudgeText.trim()} className="btn btn--primary">
          Send Private Note
        </button>
      </form>

      {nudgeResponse ? (
        <div className="alert alert--success">Tutor update: {nudgeResponse}</div>
      ) : null}

      <TranscriptFeed messages={messages} showVisibilityScope />
    </section>
  );
}
