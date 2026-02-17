"use client";
import { TranscriptFeed } from "../../components/transcript/TranscriptFeed.js";

export function TranscriptPanel({ activeSession, nudgeText, setNudgeText, onSendNudge, loading, nudgeResponse, messages }) {
  if (!activeSession) {
    return null;
  }

  return (
    <section className="card">
      <h2 className="section-title">Live Nudge + Transcript</h2>
      <p className="section-muted">Nudges are private guidance for the tutor and never shown verbatim to the child.</p>

      <form onSubmit={onSendNudge} className="voice-row">
        <input
          className="input"
          placeholder="Hidden nudge to tutor"
          value={nudgeText}
          onChange={(event) => setNudgeText(event.target.value)}
        />
        <button type="submit" disabled={loading || !nudgeText.trim()} className="btn btn--primary">
          Send Nudge
        </button>
      </form>

      {nudgeResponse ? (
        <div className="alert alert--success">Tutor response: {nudgeResponse}</div>
      ) : null}

      <TranscriptFeed messages={messages} showVisibilityScope />
    </section>
  );
}
