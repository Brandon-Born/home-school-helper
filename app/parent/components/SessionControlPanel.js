"use client";
import { SelectField, TextAreaField, TextField } from "../../components/forms/FormFields.js";

export function SessionControlPanel({
  children,
  selectedChildId,
  setSelectedChildId,
  sessionForm,
  setSessionForm,
  onStartSession,
  activeSession,
  loading,
  onEnableOverride,
  onDisableOverride
}) {
  const childOptions = [
    { value: "", label: "Pick a child" },
    ...children.map((child) => ({
      value: child.id,
      label: `${child.first_name} (Grade ${child.grade})`
    }))
  ];

  return (
    <section className="card">
      <h2 className="section-title">Start a lesson</h2>
      <p className="section-muted">Pick a child, set the focus, and create a join code.</p>
      <form onSubmit={onStartSession} className="form-grid">
        <SelectField
          id="selected-child"
          label="Child"
          value={selectedChildId}
          onChange={(event) => setSelectedChildId(event.target.value)}
          options={childOptions}
        />
        <TextField
          id="daily-subjects"
          label="Today's subject"
          placeholder="Math"
          value={sessionForm.daily_subjects}
          onChange={(event) => setSessionForm((prev) => ({ ...prev, daily_subjects: event.target.value }))}
        />
        <TextAreaField
          id="parent-context"
          label="Notes for the tutor (private)"
          placeholder="Keep answers short. Ask guiding questions first."
          value={sessionForm.parent_context}
          onChange={(event) => setSessionForm((prev) => ({ ...prev, parent_context: event.target.value }))}
        />
        <TextAreaField
          id="goal-notes"
          label="Today's goal"
          placeholder="Finish one-step equations"
          value={sessionForm.goal_notes}
          onChange={(event) => setSessionForm((prev) => ({ ...prev, goal_notes: event.target.value }))}
        />
        <TextAreaField
          id="additional-context"
          label="Extra context (optional)"
          placeholder="Had a long day — keep it light"
          value={sessionForm.additional_context}
          onChange={(event) => setSessionForm((prev) => ({ ...prev, additional_context: event.target.value }))}
        />

        <div className="btn-row">
          <button type="submit" disabled={loading || !selectedChildId} className="btn btn--primary">
            Create join code
          </button>
        </div>
      </form>

      {activeSession ? (
        <div className="card card--accent" style={{ marginTop: 16 }}>
          <p className="section-muted">Share this code with your child:</p>
          <div className="join-code">{activeSession.join_code}</div>
          <p className="section-muted" style={{ marginTop: 8 }}>
            Expires at {activeSession.expires_at}
          </p>
          <p className="section-muted" style={{ fontSize: "0.88rem" }}>
            The tutor gives hints first by default. Switch to direct answers only when needed.
          </p>
          <div className="btn-row" style={{ marginTop: 8 }}>
            <button type="button" onClick={onEnableOverride} disabled={loading} className="btn btn--secondary">
              Allow direct answers (15 min)
            </button>
            <button type="button" onClick={onDisableOverride} disabled={loading} className="btn btn--ghost">
              Back to guided mode
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
