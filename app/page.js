import Link from "next/link";
import { AppShell } from "./components/layout/AppShell.js";
import styles from "./page.module.css";

export default function HomePage() {
  return (
    <AppShell
      role="home"
      title="A calmer, smarter tutoring flow for homeschool families."
      subtitle="Parents keep control in a private channel while kids get voice-friendly, scaffold-first tutoring on their own screen."
    >
      <section className={`${styles.hero} card card--accent reveal`}>
        <div className={styles.heroCopy}>
          <h2 className="section-title">Built for real sessions at the kitchen table.</h2>
          <p className="section-muted">
            Start a session from the parent console, share a one-time join code, and guide the tutor silently while your child
            stays focused.
          </p>
          <div className="btn-row">
            <Link href="/parent" className="btn btn--primary">
              Open Parent Console
            </Link>
            <Link href="/child" className="btn btn--secondary">
              Open Child Surface
            </Link>
          </div>
        </div>
        <div className={styles.trustPanel}>
          <h3 className={styles.trustTitle}>Core commitments</h3>
          <ul className={styles.trustList}>
            <li>Scaffold-first tutoring to support learning process, not shortcuts.</li>
            <li>Hidden parent nudges stay private and never show up verbatim to the child.</li>
            <li>Transcript retention defaults to 30 days with scheduled auto-purge.</li>
          </ul>
        </div>
      </section>

      <section className={`${styles.routeGrid} stagger`}>
        <article className="card card--elevated">
          <span className="pill">For Parents</span>
          <h2 className="section-title">Run the lesson with confidence</h2>
          <p className="section-muted">
            Sign in with Google, create child profiles, launch guided sessions, and steer the tutor in real time.
          </p>
          <Link href="/parent" className="btn btn--primary">
            Go to Parent
          </Link>
        </article>
        <article className="card card--elevated">
          <span className="pill">For Students</span>
          <h2 className="section-title">Join and ask naturally</h2>
          <p className="section-muted">
            Use a short-lived code, then ask by voice or text while the tutor responds with clear, age-appropriate guidance.
          </p>
          <Link href="/child" className="btn btn--secondary">
            Go to Child
          </Link>
        </article>
      </section>
    </AppShell>
  );
}
