"use client";

export function JoinSessionPanel({ joinCode, setJoinCode, deviceFingerprint, setDeviceFingerprint, onSubmit, loading }) {
  return (
    <section className="card card--elevated">
      <h2 className="section-title">Join Your Lesson</h2>
      <p className="section-muted">Enter the code your parent gives you.</p>

      <form onSubmit={onSubmit} className="form-grid">
        <div className="field">
          <label className="label" htmlFor="join-code">
            Session code
          </label>
          <input
            id="join-code"
            className="input"
            placeholder="AB12CD34"
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value)}
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
            Start Lesson
          </button>
        </div>
      </form>
    </section>
  );
}
