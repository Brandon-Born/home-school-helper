"use client";

export function AuthPanel({ session, needsReauth, parentProfile, loading, onRefresh, onSignOut, onSignIn }) {
  if (!session) {
    return (
      <section className="card card--elevated">
        <h2 className="section-title">Parent Access</h2>
        <p className="section-muted">
          {needsReauth
            ? "Your session expired. Sign in again to continue managing sessions."
            : "Sign in with Google to manage child profiles and sessions."}
        </p>
        <button onClick={onSignIn} type="button" className="btn btn--primary">
          {needsReauth ? "Sign in again" : "Continue with Google"}
        </button>
      </section>
    );
  }

  return (
    <section className="card card--elevated">
      <h2 className="section-title">Signed In</h2>
      <p className="section-muted">
        Signed in as <strong>{session.user?.email}</strong>
      </p>
      <div className="btn-row">
        <button onClick={onRefresh} type="button" disabled={loading} className="btn btn--secondary">
          Refresh
        </button>
        <button onClick={onSignOut} type="button" disabled={loading} className="btn btn--ghost">
          Sign out
        </button>
      </div>
      {parentProfile ? (
        <p className="section-muted">
          Parent profile id: <code>{parentProfile.id}</code>
        </p>
      ) : null}
    </section>
  );
}
