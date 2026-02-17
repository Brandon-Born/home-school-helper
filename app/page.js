import Link from "next/link";

const cardStyle = {
  border: "1px solid #d9d9d9",
  borderRadius: 12,
  padding: 20,
  minWidth: 260,
  flex: 1
};

export default function HomePage() {
  return (
    <main style={{ maxWidth: 920, margin: "0 auto", padding: 24 }}>
      <h1 style={{ marginBottom: 8 }}>Homeschool Tutor</h1>
      <p style={{ marginTop: 0, color: "#444" }}>
        Parent and child can run in parallel on different devices using a shared session.
      </p>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 20 }}>
        <section style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Parent Surface</h2>
          <p>Sign in with Google, onboard child profiles, start sessions, and send hidden nudges.</p>
          <Link href="/parent">Open Parent</Link>
        </section>

        <section style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Child Surface</h2>
          <p>Join with a one-time code and chat with the tutor using child-scoped access.</p>
          <Link href="/child">Open Child</Link>
        </section>
      </div>
    </main>
  );
}
