"use client";

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: 10,
  border: "1px solid #c8c8c8",
  borderRadius: 8
};

const cardStyle = {
  border: "1px solid #dadada",
  borderRadius: 12,
  padding: 16,
  marginBottom: 16,
  background: "#fff"
};

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
  return (
    <section style={cardStyle}>
      <h2 style={{ marginTop: 0 }}>Start Session</h2>
      <form onSubmit={onStartSession} style={{ display: "grid", gap: 10 }}>
        <select
          style={inputStyle}
          value={selectedChildId}
          onChange={(event) => setSelectedChildId(event.target.value)}
        >
          <option value="">Select child</option>
          {children.map((child) => (
            <option key={child.id} value={child.id}>
              {child.first_name} (Grade {child.grade})
            </option>
          ))}
        </select>

        <input
          style={inputStyle}
          placeholder="Today's subjects (comma separated)"
          value={sessionForm.daily_subjects}
          onChange={(event) => setSessionForm((prev) => ({ ...prev, daily_subjects: event.target.value }))}
        />
        <textarea
          style={{ ...inputStyle, minHeight: 70 }}
          placeholder="Parent context for today"
          value={sessionForm.parent_context}
          onChange={(event) => setSessionForm((prev) => ({ ...prev, parent_context: event.target.value }))}
        />
        <textarea
          style={{ ...inputStyle, minHeight: 70 }}
          placeholder="Goal notes"
          value={sessionForm.goal_notes}
          onChange={(event) => setSessionForm((prev) => ({ ...prev, goal_notes: event.target.value }))}
        />
        <textarea
          style={{ ...inputStyle, minHeight: 70 }}
          placeholder="Additional context"
          value={sessionForm.additional_context}
          onChange={(event) => setSessionForm((prev) => ({ ...prev, additional_context: event.target.value }))}
        />

        <button type="submit" disabled={loading || !selectedChildId}>
          Start Session
        </button>
      </form>

      {activeSession ? (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: "#eef4ff" }}>
          <p style={{ margin: "4px 0" }}>
            Session id: <code>{activeSession.session_id}</code>
          </p>
          <p style={{ margin: "4px 0" }}>
            Child join code: <strong>{activeSession.join_code}</strong>
          </p>
          <p style={{ margin: "4px 0" }}>Expires at: {activeSession.expires_at}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <button type="button" onClick={onEnableOverride} disabled={loading}>
              Enable Direct Answers (15m)
            </button>
            <button type="button" onClick={onDisableOverride} disabled={loading}>
              Disable Direct Answers
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
