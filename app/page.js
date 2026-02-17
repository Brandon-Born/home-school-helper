import Link from "next/link";
import { AppShell } from "./components/layout/AppShell.js";
import styles from "./page.module.css";

export default function HomePage() {
  return (
    <AppShell
      role="home"
      title="Homeschool tutoring where parents guide and kids stay focused."
      subtitle="Parents set the plan and send private guidance. Kids join with a code and get clear, step-by-step help."
    >
      <section className={`${styles.hero} card card--accent reveal`}>
        <div className={styles.heroCopy}>
          <h2 className="section-title">Two simple screens for one shared lesson.</h2>
          <p className="section-muted">
            Parents start the lesson and share a one-time code. Children join on their screen while parents quietly guide the
            tutor in the background.
          </p>
          <div className="btn-row">
            <Link href="/parent" className="btn btn--primary">
              Open Parent Screen
            </Link>
            <Link href="/child" className="btn btn--secondary">
              Open Child Screen
            </Link>
          </div>
        </div>
        <div className={styles.trustPanel}>
          <h3 className={styles.trustTitle}>What this app is built to do</h3>
          <ul className={styles.trustList}>
            <li>Teach step by step so children learn the process, not just the final answer.</li>
            <li>Keep parent guidance private so the child sees a calm, focused tutoring chat.</li>
            <li>Auto-delete transcripts after 30 days by default.</li>
          </ul>
        </div>
      </section>

      <section className={`${styles.routeGrid} stagger`}>
        <article className="card card--elevated">
          <span className="pill">For Parents</span>
          <h2 className="section-title">Plan, launch, and guide each lesson</h2>
          <p className="section-muted">
            Sign in, create child profiles, start a session, and send private notes that guide the tutor in real time.
          </p>
          <Link href="/parent" className="btn btn--primary">
            Open Parent Screen
          </Link>
        </article>
        <article className="card card--elevated">
          <span className="pill">For Students</span>
          <h2 className="section-title">Join quickly and ask naturally</h2>
          <p className="section-muted">
            Enter a one-time code, then ask by voice or text and get age-appropriate, step-by-step support.
          </p>
          <Link href="/child" className="btn btn--secondary">
            Open Child Screen
          </Link>
        </article>
      </section>
    </AppShell>
  );
}
