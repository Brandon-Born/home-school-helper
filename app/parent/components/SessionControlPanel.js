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
    { value: "", label: "Select child" },
    ...children.map((child) => ({
      value: child.id,
      label: `${child.first_name} (Grade ${child.grade})`
    }))
  ];

  return (
    <section className="card">
      <h2 className="section-title">Start Session</h2>
      <p className="section-muted">Create a one-time code and pass context privately to the tutor.</p>
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
          label="Parent context"
          placeholder="Focus on confidence and step-by-step reasoning."
          value={sessionForm.parent_context}
          onChange={(event) => setSessionForm((prev) => ({ ...prev, parent_context: event.target.value }))}
        />
        <TextAreaField
          id="goal-notes"
          label="Goal notes"
          placeholder="Finish one-step equations."
          value={sessionForm.goal_notes}
          onChange={(event) => setSessionForm((prev) => ({ ...prev, goal_notes: event.target.value }))}
        />
        <TextAreaField
          id="additional-context"
          label="Additional context"
          placeholder="Student had a long morning."
          value={sessionForm.additional_context}
          onChange={(event) => setSessionForm((prev) => ({ ...prev, additional_context: event.target.value }))}
        />

        <div className="btn-row">
          <button type="submit" disabled={loading || !selectedChildId} className="btn btn--primary">
            Start Session
          </button>
        </div>
      </form>

      {activeSession ? (
        <div className="card card--accent">
          <p className="section-muted">
            Session id: <code>{activeSession.session_id}</code>
          </p>
          <p className="section-muted">Child join code</p>
          <div className="join-code">{activeSession.join_code}</div>
          <p className="section-muted">Expires at: {activeSession.expires_at}</p>
          <div className="btn-row">
            <button type="button" onClick={onEnableOverride} disabled={loading} className="btn btn--secondary">
              Enable Direct Answers (15m)
            </button>
            <button type="button" onClick={onDisableOverride} disabled={loading} className="btn btn--danger">
              Disable Direct Answers
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
