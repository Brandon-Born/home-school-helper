import Link from "next/link";
import { AppShell } from "../components/layout/AppShell.js";
import {
  buildMarketingMetadata,
  getBreadcrumbJsonLd,
  serializeJsonLd
} from "../../src/lib/seo.js";
import styles from "./page.module.css";

export const metadata = buildMarketingMetadata({
  title: "Parent Guides for Homeschool AI Tutoring | Homeschool Sidekick",
  description:
    "Practical parent guides for using AI tutoring in homeschooling: voice-first tutoring, math help, privacy-aware workflows, and parent-guided learning routines.",
  path: "/guides"
});

const GUIDE_CARDS = [
  {
    href: "/ai-tutor-for-homeschool",
    eyebrow: "Getting started",
    title: "AI tutor for homeschool families",
    description:
      "A practical overview of parent-guided AI tutoring for homeschool learning, including setup, pacing, and hints-first coaching."
  },
  {
    href: "/voice-tutor-for-kids",
    eyebrow: "Voice-first",
    title: "Voice tutor for kids",
    description:
      "How to run voice-first tutoring sessions for younger learners while parents control topic, pacing, and coaching."
  },
  {
    href: "/math-help-for-homeschool",
    eyebrow: "Math practice",
    title: "Math help for homeschool",
    description:
      "Use AI math help for guided practice, repeated explanations, and step-by-step reasoning without answer-dumping."
  }
];

export default function GuidesPage() {
  const breadcrumbJsonLd = serializeJsonLd(
    getBreadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Guides", path: "/guides" }
    ])
  );

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />

      <AppShell
        role="home"
        title="Parent guides for AI tutoring at home"
        subtitle="Search-friendly, practical walkthroughs for homeschool families using Homeschool Sidekick for voice-first tutoring, math practice, and parent-guided learning routines."
      >
        <section className={`${styles.hero} card card--elevated`}>
          <h2 className={styles.heading}>Choose a guide based on the learning problem you&apos;re solving</h2>
          <p className={styles.body}>
            Start with the general guide if you&apos;re new to AI tutoring in homeschooling. Then use the topic-specific guides to improve voice-first sessions, math practice blocks, and parent coaching workflows.
          </p>
          <div className={styles.pills}>
            <span className={styles.pill}>Parent-guided</span>
            <span className={styles.pill}>Hints-first</span>
            <span className={styles.pill}>Voice-first options</span>
            <span className={styles.pill}>Privacy-aware</span>
          </div>
        </section>

        <section className={styles.grid} aria-labelledby="guides-list-heading">
          <h2 id="guides-list-heading" className="sr-only">Guide list</h2>
          {GUIDE_CARDS.map((guide) => (
            <article key={guide.href} className={`${styles.card} card card--glass`}>
              <div>
                <p className={styles.eyebrow}>{guide.eyebrow}</p>
                <h3 className={styles.heading}>{guide.title}</h3>
                <p className={styles.body}>{guide.description}</p>
              </div>
              <div className="btn-row">
                <Link href={guide.href} className="btn btn--secondary">Read guide</Link>
              </div>
            </article>
          ))}
        </section>

        <section className={`${styles.nextSteps} card`}>
          <h2 className={styles.heading}>What to do after reading a guide</h2>
          <ol className={styles.list}>
            <li>Pick one short session goal for your child (10-15 minutes).</li>
            <li>Write a parent note describing the skill to reinforce.</li>
            <li>Run a session and review the transcript for patterns.</li>
            <li>Adjust the next session based on what your child struggled with.</li>
          </ol>
          <div className="btn-row">
            <Link href="/parent" className="btn btn--primary">Start as a parent</Link>
            <Link href="/" className="btn btn--ghost">Back to homepage</Link>
          </div>
        </section>
      </AppShell>
    </>
  );
}
