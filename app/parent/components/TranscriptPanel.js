"use client";
import { TranscriptFeed } from "../../components/transcript/TranscriptFeed.js";
import { StatusAlert } from "../../components/feedback/StatusAlert.js";

export function TranscriptPanel({ activeSession, nudgeText, setNudgeText, onSendNudge, loading, nudgeAlert, messages }) {
  if (!activeSession) {
    return null;
  }

  return (
    <section className="card">
      <h2 className="section-title">Guide the session</h2>
      <p className="section-muted">Send private notes — your child won't see them.</p>

      <form onSubmit={onSendNudge} className="voice-row" aria-busy={loading}>
        <label className="sr-only" htmlFor="parent-nudge-input">
          Private nudge for tutor
        </label>
        <input
          id="parent-nudge-input"
          className="input"
          placeholder="Slow down, use shorter examples"
          value={nudgeText}
          onChange={(event) => setNudgeText(event.target.value)}
          aria-label="Private nudge for tutor"
        />
        <button type="submit" disabled={loading || !nudgeText.trim()} className="btn btn--primary">
          Send
        </button>
      </form>

      <StatusAlert
        tone={nudgeAlert?.tone}
        message={nudgeAlert?.message}
        style={{ marginTop: 10 }}
      />

      <TranscriptFeed messages={messages} showVisibilityScope />
    </section>
  );
}
