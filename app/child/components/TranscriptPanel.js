"use client";

const cardStyle = {
  border: "1px solid #dadada",
  borderRadius: 12,
  padding: 16,
  marginBottom: 16,
  background: "#fff"
};

export function TranscriptPanel({ messages, pendingTutorReply }) {
  return (
    <section style={cardStyle}>
      <div
        style={{
          border: "1px solid #e3e3e3",
          borderRadius: 8,
          background: "#fafafa",
          padding: 10,
          maxHeight: 360,
          overflow: "auto"
        }}
      >
        {messages.length === 0 ? (
          <p style={{ margin: 0, color: "#666" }}>No messages yet.</p>
        ) : (
          messages.map((message) => (
            <div key={message.id} style={{ marginBottom: 8 }}>
              <strong>{message.actor_type}</strong>
              <div>{message.content}</div>
            </div>
          ))
        )}
        {pendingTutorReply ? (
          <div style={{ marginTop: 10, color: "#175cd3", fontStyle: "italic" }}>Tutor is thinking...</div>
        ) : null}
      </div>
    </section>
  );
}
