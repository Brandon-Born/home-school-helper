"use client";

export function JoinSessionPanel({ joinCode, setJoinCode, deviceFingerprint, setDeviceFingerprint, onSubmit, loading }) {
  return (
    <section className="card card--elevated">
      <h2 className="section-title">Ready to learn? 📚</h2>
      <p className="section-muted">Type the code your parent gave you.</p>

      <form onSubmit={onSubmit} className="form-grid" aria-busy={loading}>
        <div className="field">
          <label className="label" htmlFor="join-code">
            Your code
          </label>
          <input
            id="join-code"
            className="input"
            placeholder="AB12CD34"
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
            autoFocus
            required
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="device-fingerprint">
            Device name (optional)
          </label>
          <input
            id="device-fingerprint"
            className="input"
            placeholder="My iPad"
            value={deviceFingerprint}
            onChange={(event) => setDeviceFingerprint(event.target.value)}
          />
        </div>
        <div className="btn-row">
          <button type="submit" disabled={loading || !joinCode.trim()} className="btn btn--primary">
            Let's go! 🚀
          </button>
        </div>
      </form>
    </section>
  );
}
