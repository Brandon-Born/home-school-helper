"use client";

export function AuthPanel({ session, needsReauth, parentProfile, loading, onRefresh, onSignOut, onSignIn }) {
  const cardStyle = {
    border: "1px solid #dadada",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    background: "#fff"
  };

  if (!session) {
    return (
      <section style={cardStyle}>
        <p>
          {needsReauth
            ? "Your session expired. Sign in again to continue managing sessions."
            : "Sign in with Google to manage child profiles and sessions."}
        </p>
        <button onClick={onSignIn} type="button">
          {needsReauth ? "Sign in again" : "Continue with Google"}
        </button>
      </section>
    );
  }

  return (
    <section style={cardStyle}>
      <p style={{ marginTop: 0 }}>
        Signed in as <strong>{session.user?.email}</strong>
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={onRefresh} type="button" disabled={loading}>
          Refresh
        </button>
        <button onClick={onSignOut} type="button" disabled={loading}>
          Sign out
        </button>
      </div>
      {parentProfile ? (
        <p style={{ marginBottom: 0 }}>
          Parent profile id: <code>{parentProfile.id}</code>
        </p>
      ) : null}
    </section>
  );
}
