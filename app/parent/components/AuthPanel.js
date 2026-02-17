"use client";

export function AuthPanel({ session, needsReauth, parentProfile, loading, onRefresh, onSignOut, onSignIn }) {
  if (!session) {
    return (
      <section className="card card--elevated">
        <h2 className="section-title">Welcome back 👋</h2>
        <p className="section-muted">
          {needsReauth
            ? "Your session expired — sign in again to pick up where you left off."
            : "Sign in to set up lessons and guide your child's tutor."}
        </p>
        <button onClick={onSignIn} type="button" className="btn btn--primary">
          {needsReauth ? "Sign in again" : "Sign in with Google"}
        </button>
      </section>
    );
  }

  return (
    <section className="card card--elevated">
      <h2 className="section-title">Your account</h2>
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
    </section>
  );
}
