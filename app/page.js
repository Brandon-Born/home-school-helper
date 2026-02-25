import Link from "next/link";
import { AppShell } from "./components/layout/AppShell.js";
import styles from "./page.module.css";
import {
  buildMarketingMetadata,
  getHomepageWebApplicationJsonLd,
  getOrganizationJsonLd,
  getWebsiteJsonLd,
  serializeJsonLd
} from "../src/lib/seo.js";

export const metadata = buildMarketingMetadata({
  title: "Homeschool Sidekick",
  description: "Your AI-powered homeschool sidekick — parents steer, kids learn, step by step.",
  path: "/"
});

export default function HomePage() {
  const organizationJsonLd = serializeJsonLd(getOrganizationJsonLd());
  const websiteJsonLd = serializeJsonLd(getWebsiteJsonLd());
  const webAppJsonLd = serializeJsonLd(getHomepageWebApplicationJsonLd());

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: organizationJsonLd }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: websiteJsonLd }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: webAppJsonLd }} />

      <AppShell
        role="home"
        title="Your child's AI tutor — guided by you."
        subtitle="Homeschool Sidekick is an AI-powered tutor your child can talk to — by voice or keyboard. You set the lesson focus, monitor the conversation, and send private hints, all while your child gets patient, step-by-step help."
      >
        <section className={styles.howItWorks} aria-labelledby="pricing-heading">
          <h2 id="pricing-heading" className={styles.howItWorksTitle}>Family plan pricing</h2>
          <div className={`${styles.ctaCard} card card--elevated`}>
            <p className="section-muted">
              <strong>$1.99 for the first month</strong>, then <strong>$9.99/month</strong>.
              You can cancel anytime from the parent billing portal.
            </p>
            <p style={{ marginTop: 12, marginBottom: 12 }}>
              <Link href="/parent" className="btn btn--primary">
                Start family plan
              </Link>
            </p>
            <p className="section-muted">
              See our <Link href="/billing-policy">Billing Policy</Link> and{" "}
              <Link href="/terms">Terms of Service</Link> for full details.
            </p>
          </div>
        </section>

        {/* ── How it works ────────────────────────── */}
        <section className={`${styles.howItWorks} reveal`}>
          <h2 className={styles.howItWorksTitle}>How it works</h2>
          <div className={styles.steps}>
            <div className={styles.step}>
              <span className={styles.stepNumber}>1</span>
              <h3 className={styles.stepLabel}>Parent sets the lesson</h3>
              <p className="section-muted">
                Sign in, pick a subject, and add private notes about what your child should focus on today.
              </p>
            </div>
            <div className={styles.step}>
              <span className={styles.stepNumber}>2</span>
              <h3 className={styles.stepLabel}>Child joins with a code</h3>
              <p className="section-muted">
                Share a short join code — no account needed. Your child enters it and starts talking to their AI tutor by voice or keyboard.
              </p>
            </div>
            <div className={styles.step}>
              <span className={styles.stepNumber}>3</span>
              <h3 className={styles.stepLabel}>Learn together</h3>
              <p className="section-muted">
                The AI gives hints, not answers. You can watch the conversation live or send private nudges only the tutor sees. The full transcript is saved for you to review later.
              </p>
            </div>
          </div>
        </section>

        {/* ── Key features ────────────────────────── */}
        <section className={`${styles.features} stagger`} aria-labelledby="home-features-heading">
          <h2 id="home-features-heading" className="sr-only">Key features</h2>
          <div className={styles.featureItem}>
            <span className={styles.featureIcon}>🎙️</span>
            <div>
              <h3 className={styles.featureTitle}>Voice-first for young learners</h3>
              <p className="section-muted">Kids can press a button and talk — no typing required. The AI listens, responds out loud, and keeps a written transcript for parents.</p>
            </div>
          </div>
          <div className={styles.featureItem}>
            <span className={styles.featureIcon}>💡</span>
            <div>
              <h3 className={styles.featureTitle}>Hints first, never answers</h3>
              <p className="section-muted">The AI tutor walks your child through problems step by step — they learn by doing, not copying.</p>
            </div>
          </div>
          <div className={styles.featureItem}>
            <span className={styles.featureIcon}>🔒</span>
            <div>
              <h3 className={styles.featureTitle}>Invisible parent guidance</h3>
              <p className="section-muted">Send private notes that shape the lesson. The AI reads them, but your child never sees them. Stay in control without hovering.</p>
            </div>
          </div>
          <div className={styles.featureItem}>
            <span className={styles.featureIcon}>🗑️</span>
            <div>
              <h3 className={styles.featureTitle}>Nothing stored forever</h3>
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

        <section className={`${styles.guidesSection} reveal`} aria-labelledby="parent-guides-heading">
          <h2 id="parent-guides-heading" className="sr-only">Parent guides</h2>
          <div className={styles.guidesGrid}>
            <div className={`${styles.guidesCard} card card--glass`}>
              <div>
                <p className={styles.guidesEyebrow}>Parent guide</p>
                <h3 className="section-title">How to use an AI tutor for homeschool learning</h3>
                <p className="section-muted">
                  A practical walkthrough for using AI tutoring as support practice while parents stay in control of goals, pacing, and privacy.
                </p>
              </div>
              <Link href="/ai-tutor-for-homeschool" className="btn btn--secondary">
                Read the guide
              </Link>
            </div>

            <div className={`${styles.guidesCard} card card--glass`}>
              <div>
                <p className={styles.guidesEyebrow}>Parent guide</p>
                <h3 className="section-title">Voice tutor for kids (voice-first setup)</h3>
                <p className="section-muted">
                  How to use a voice-first tutor flow for younger learners while keeping parents in control of topic, pacing, and coaching.
                </p>
              </div>
              <Link href="/voice-tutor-for-kids" className="btn btn--secondary">
                Read the guide
              </Link>
            </div>

            <div className={`${styles.guidesCard} card card--glass`}>
              <div>
                <p className={styles.guidesEyebrow}>Parent guide</p>
                <h3 className="section-title">Math help for homeschool (hints-first)</h3>
                <p className="section-muted">
                  A practical way to use AI tutoring for math practice, repeated explanations, and voice-first reasoning while parents control the lesson goal.
                </p>
              </div>
              <Link href="/math-help-for-homeschool" className="btn btn--secondary">
                Read the guide
              </Link>
            </div>

            <div className={`${styles.guidesCard} card card--glass`}>
              <div>
                <p className={styles.guidesEyebrow}>Guides hub</p>
                <h3 className="section-title">Browse all parent guides</h3>
                <p className="section-muted">
                  See every guide in one place and pick the best starting point for homeschool setup, voice tutoring, or math practice support.
                </p>
              </div>
              <Link href="/guides" className="btn btn--ghost">
                Open guides hub
              </Link>
            </div>
          </div>
        </section>
      </AppShell>
    </>
  );
}
