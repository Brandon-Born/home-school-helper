import Link from "next/link";
import { AppShell } from "./components/layout/AppShell.js";
import styles from "./page.module.css";

export default function HomePage() {
  return (
    <AppShell
      role="home"
      title="Your child's AI tutor — guided by you."
      subtitle="Homeschool Sidekick is an AI-powered tutor your child can talk to — by voice or keyboard. You set the lesson focus, monitor the conversation, and send private hints, all while your child gets patient, step-by-step help."
    >
      {/* ── How it works ────────────────────────── */}
      <section className={`${styles.howItWorks} reveal`}>
        <h2 className={styles.howItWorksTitle}>How it works</h2>
        <div className={styles.steps}>
          <div className={styles.step}>
            <span className={styles.stepNumber}>1</span>
            <strong className={styles.stepLabel}>Parent sets the lesson</strong>
            <p className="section-muted">
              Sign in, pick a subject, and add private notes about what your child should focus on today.
            </p>
          </div>
          <div className={styles.step}>
            <span className={styles.stepNumber}>2</span>
            <strong className={styles.stepLabel}>Child joins with a code</strong>
            <p className="section-muted">
              Share a short join code — no account needed. Your child enters it and starts talking to their AI tutor by voice or keyboard.
            </p>
          </div>
          <div className={styles.step}>
            <span className={styles.stepNumber}>3</span>
            <strong className={styles.stepLabel}>Learn together</strong>
            <p className="section-muted">
              The AI gives hints, not answers. You can watch the conversation live or send private nudges only the tutor sees. The full transcript is saved for you to review later.
            </p>
          </div>
        </div>
      </section>

      {/* ── Key features ────────────────────────── */}
      <section className={`${styles.features} stagger`}>
        <div className={styles.featureItem}>
          <span className={styles.featureIcon}>🎙️</span>
          <div>
            <strong>Voice-first for young learners</strong>
            <p className="section-muted">Kids can press a button and talk — no typing required. The AI listens, responds out loud, and keeps a written transcript for parents.</p>
          </div>
        </div>
        <div className={styles.featureItem}>
          <span className={styles.featureIcon}>💡</span>
          <div>
            <strong>Hints first, never answers</strong>
            <p className="section-muted">The AI tutor walks your child through problems step by step — they learn by doing, not copying.</p>
          </div>
        </div>
        <div className={styles.featureItem}>
          <span className={styles.featureIcon}>🔒</span>
          <div>
            <strong>Invisible parent guidance</strong>
            <p className="section-muted">Send private notes that shape the lesson. The AI reads them, but your child never sees them. Stay in control without hovering.</p>
          </div>
        </div>
        <div className={styles.featureItem}>
          <span className={styles.featureIcon}>🗑️</span>
          <div>
            <strong>Nothing stored forever</strong>
            <p className="section-muted">Session transcripts are automatically deleted after 30 days. No data hoarding, no tracking.</p>
          </div>
        </div>
      </section>

      {/* ── Role-picker CTAs ────────────────────── */}
      <section className={`${styles.ctaSection} reveal`}>
        <div className={`${styles.ctaCard} card card--elevated`}>
          <span className={styles.ctaEmoji}>🎓</span>
          <h2 className="section-title">I'm a parent</h2>
          <p className="section-muted">
            Sign in, add your children, and start a lesson session they can join.
          </p>
          <Link href="/parent" className="btn btn--primary">
            Get started
          </Link>
        </div>
        <div className={`${styles.ctaCard} card card--elevated`}>
          <span className={styles.ctaEmoji}>📚</span>
          <h2 className="section-title">I'm a student</h2>
          <p className="section-muted">
            Got a code from your parent? Enter it and start talking to your AI tutor — by voice or keyboard.
          </p>
          <Link href="/child" className="btn btn--secondary">
            Join a lesson
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
