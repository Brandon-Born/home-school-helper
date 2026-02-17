"use client";

const cardStyle = {
  border: "1px solid #dadada",
  borderRadius: 12,
  padding: 16,
  marginBottom: 16,
  background: "#fff"
};

export function SessionStatusPanel({ sessionAccess, voiceStatus, autoSpeak, setAutoSpeak, speechSupport, onLeave }) {
  return (
    <section style={cardStyle}>
      <p style={{ marginTop: 0 }}>
        Connected to session <code>{sessionAccess.session_id}</code>
      </p>
      <p style={{ marginBottom: 12 }}>Token expires at: {sessionAccess.expires_at}</p>
      <p style={{ marginBottom: 12 }}>{voiceStatus}</p>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" onClick={onLeave}>
          Leave Session
        </button>
        <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={autoSpeak}
            onChange={(event) => setAutoSpeak(event.target.checked)}
            disabled={!speechSupport.cloudTts && !speechSupport.browserTts}
          />
          Auto-speak tutor replies
        </label>
      </div>
    </section>
  );
}
