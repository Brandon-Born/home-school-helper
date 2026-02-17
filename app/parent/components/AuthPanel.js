"use client";

export function AuthPanel({ session, needsReauth, parentProfile, loading, onRefresh, onSignOut, onSignIn }) {
  if (!session) {
    return (
      <section className="card card--elevated">
        <h2 className="section-title">Parent Sign-In</h2>
        <p className="section-muted">
          {needsReauth
            ? "Your sign-in expired. Please sign in again to continue."
            : "Sign in with Google to manage child profiles and tutoring sessions."}
        </p>
        <button onClick={onSignIn} type="button" className="btn btn--primary">
          {needsReauth ? "Sign In Again" : "Sign In with Google"}
        </button>
      </section>
    );
  }

  return (
    <section className="card card--elevated">
      <h2 className="section-title">Parent Account</h2>
      <p className="section-muted">
        Signed in as <strong>{session.user?.email}</strong>
      </p>
      <div className="btn-row">
        <button onClick={onRefresh} type="button" disabled={loading} className="btn btn--secondary">
          Refresh Data
        </button>
        <button onClick={onSignOut} type="button" disabled={loading} className="btn btn--ghost">
          Sign Out
        </button>
      </div>
      {parentProfile ? (
        <p className="section-muted">
          Account ID (for support): <code>{parentProfile.id}</code>
        </p>
      ) : null}
    </section>
  );
}
