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

export function JoinSessionPanel({ joinCode, setJoinCode, deviceFingerprint, setDeviceFingerprint, onSubmit, loading }) {
  return (
    <section style={cardStyle}>
      <h2 style={{ marginTop: 0 }}>Join Session</h2>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
        <input
          style={inputStyle}
          placeholder="Session code"
          value={joinCode}
          onChange={(event) => setJoinCode(event.target.value)}
        />
        <input
          style={inputStyle}
          placeholder="Device fingerprint (optional)"
          value={deviceFingerprint}
          onChange={(event) => setDeviceFingerprint(event.target.value)}
        />
        <button type="submit" disabled={loading || !joinCode.trim()}>
          Join
        </button>
      </form>
    </section>
  );
}
