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
    { value: "", label: "Choose a child" },
    ...children.map((child) => ({
      value: child.id,
      label: `${child.first_name} (Grade ${child.grade})`
    }))
  ];

  return (
    <section className="card">
      <h2 className="section-title">Start a New Session</h2>
      <p className="section-muted">Choose a child, set today&apos;s focus, and create a one-time code to share.</p>
      <form onSubmit={onStartSession} className="form-grid">
        <SelectField
          id="selected-child"
          label="Child profile"
          value={selectedChildId}
          onChange={(event) => setSelectedChildId(event.target.value)}
          options={childOptions}
        />
        <TextField
          id="daily-subjects"
          label="Today's subjects"
          placeholder="Math, Reading"
          value={sessionForm.daily_subjects}
          onChange={(event) => setSessionForm((prev) => ({ ...prev, daily_subjects: event.target.value }))}
        />
        <TextAreaField
          id="parent-context"
          label="Private notes for the tutor"
          placeholder="Keep directions short and encouraging. Ask guiding questions before hints."
          value={sessionForm.parent_context}
          onChange={(event) => setSessionForm((prev) => ({ ...prev, parent_context: event.target.value }))}
        />
        <TextAreaField
          id="goal-notes"
          label="Today's goal"
          placeholder="Finish one-step equations and explain each step aloud."
          value={sessionForm.goal_notes}
          onChange={(event) => setSessionForm((prev) => ({ ...prev, goal_notes: event.target.value }))}
        />
        <TextAreaField
          id="additional-context"
          label="Anything else for today (optional)"
          placeholder="Student is tired after co-op class. Keep the pace calm."
          value={sessionForm.additional_context}
          onChange={(event) => setSessionForm((prev) => ({ ...prev, additional_context: event.target.value }))}
        />

        <div className="btn-row">
          <button type="submit" disabled={loading || !selectedChildId} className="btn btn--primary">
            Create Session Code
          </button>
        </div>
      </form>

      {activeSession ? (
        <div className="card card--accent">
          <p className="section-muted">
            Session ID (for support): <code>{activeSession.session_id}</code>
          </p>
          <p className="section-muted">Child join code</p>
          <div className="join-code">{activeSession.join_code}</div>
          <p className="section-muted">Code expires at: {activeSession.expires_at}</p>
          <p className="section-muted">Default mode gives hints first. Use direct answers only when needed.</p>
          <div className="btn-row">
            <button type="button" onClick={onEnableOverride} disabled={loading} className="btn btn--secondary">
              Allow Direct Answers (15 min)
            </button>
            <button type="button" onClick={onDisableOverride} disabled={loading} className="btn btn--danger">
              Return to Guided Mode
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
