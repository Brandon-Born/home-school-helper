import Link from "next/link";
import { AppShell } from "./components/layout/AppShell.js";
import styles from "./page.module.css";

export default function HomePage() {
  return (
    <AppShell
      role="home"
      title="Tutoring that feels like teamwork."
      subtitle="Parents set the direction. Kids get clear, patient, step-by-step help. No sign-ups for children — just a code and they're in."
    >
      <section className={`${styles.hero} reveal`}>
        <div className={`${styles.heroCard} card card--elevated`}>
          <span className={styles.heroEmoji}>🎓</span>
          <h2 className="section-title">I'm a parent</h2>
          <p className="section-muted">
            Sign in, tell the tutor what to focus on, and guide the lesson in real time — your child never sees your notes.
          </p>
          <Link href="/parent" className="btn btn--primary">
            Get started
          </Link>
        </div>
        <div className={`${styles.heroCard} card card--elevated`}>
          <span className={styles.heroEmoji}>📚</span>
          <h2 className="section-title">I'm a student</h2>
          <p className="section-muted">
            Got a code from your parent? Type it in and start asking questions — by voice or keyboard.
          </p>
          <Link href="/child" className="btn btn--secondary">
            Join a lesson
          </Link>
        </div>
      </section>

      <section className={`${styles.features} stagger`}>
        <div className={styles.featureItem}>
          <span className={styles.featureIcon}>💡</span>
          <div>
            <strong>Hints first, not answers</strong>
            <p className="section-muted">The tutor walks kids through problems step by step so they actually learn.</p>
          </div>
        </div>
        <div className={styles.featureItem}>
          <span className={styles.featureIcon}>🔒</span>
          <div>
            <strong>Private parent guidance</strong>
            <p className="section-muted">Send notes to the tutor that your child never sees. Stay in control without hovering.</p>
          </div>
        </div>
        <div className={styles.featureItem}>
          <span className={styles.featureIcon}>🗑️</span>
          <div>
            <strong>Auto-cleanup</strong>
            <p className="section-muted">Transcripts are deleted after 30 days. No data hoarding.</p>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
