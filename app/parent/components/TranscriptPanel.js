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

export function TranscriptPanel({ activeSession, nudgeText, setNudgeText, onSendNudge, loading, nudgeResponse, messages }) {
  if (!activeSession) {
    return null;
  }

  return (
    <section style={cardStyle}>
      <h2 style={{ marginTop: 0 }}>Live Nudge + Transcript</h2>
      <form onSubmit={onSendNudge} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          style={{ ...inputStyle, flex: 1 }}
          placeholder="Hidden nudge to tutor"
          value={nudgeText}
          onChange={(event) => setNudgeText(event.target.value)}
        />
        <button type="submit" disabled={loading || !nudgeText.trim()}>
          Send
        </button>
      </form>
      {nudgeResponse ? <p style={{ marginTop: 0 }}>Tutor response: {nudgeResponse}</p> : null}

      <div
        style={{
          border: "1px solid #e3e3e3",
          borderRadius: 8,
          background: "#fafafa",
          padding: 10,
          maxHeight: 320,
          overflow: "auto"
        }}
      >
        {messages.length === 0 ? (
          <p style={{ margin: 0, color: "#666" }}>No messages yet.</p>
        ) : (
          messages.map((message) => (
            <div key={message.id} style={{ marginBottom: 8 }}>
              <strong>{message.actor_type}</strong>
              <span style={{ color: "#777" }}> [{message.visibility_scope}]</span>
              <div>{message.content}</div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
