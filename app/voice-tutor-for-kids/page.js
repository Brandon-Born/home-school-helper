import Link from "next/link";
import { AppShell } from "../components/layout/AppShell.js";
import {
  buildMarketingMetadata,
  getBreadcrumbJsonLd,
  serializeJsonLd
} from "../../src/lib/seo.js";
import styles from "./page.module.css";

export const metadata = buildMarketingMetadata({
  title: "Voice Tutor for Kids | Homeschool Sidekick",
  description:
    "A voice-first AI tutor workflow for kids who learn better by talking than typing. Parent-guided tutoring with private nudges, session monitoring, and hints-first support.",
  path: "/voice-tutor-for-kids"
});

function buildFaqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Why use a voice tutor for kids instead of text-only tutoring?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Voice tutoring can reduce friction for younger learners and kids who explain ideas better out loud. It helps them stay engaged without relying on typing speed or spelling confidence."
        }
      },
      {
        "@type": "Question",
        name: "Can parents still monitor a voice-first tutoring session?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Yes. Homeschool Sidekick keeps parents in control by allowing them to set lesson goals, review transcripts, and send private guidance while the child uses a voice-first session flow."
        }
      },
      {
        "@type": "Question",
        name: "Does a voice tutor still support hints-first learning?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Yes. Voice-first delivery changes how the tutor interacts, not the teaching model. The tutor still prioritizes guidance, questions, and step-by-step support instead of answer-dumping."
        }
      }
    ]
  };
}

export default function VoiceTutorForKidsPage() {
  const faqJsonLd = serializeJsonLd(buildFaqJsonLd());
  const breadcrumbJsonLd = serializeJsonLd(
    getBreadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Guides", path: "/guides" },
      { name: "Voice Tutor for Kids", path: "/voice-tutor-for-kids" }
    ])
  );

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd }} />

      <AppShell
        role="home"
        title="Voice tutor for kids"
        subtitle="A voice-first tutoring workflow for children who learn better by talking, with parents still guiding the lesson behind the scenes."
      >
        <section className={`${styles.heroCard} card card--elevated`}>
          <h2 className={styles.heading}>Why voice-first tutoring helps younger learners</h2>
          <p className={styles.body}>
            Many kids can explain what they know out loud before they can type it quickly. A voice tutor gives them a lower-friction way to ask questions, think through a problem, and stay focused during practice.
          </p>
          <p className={styles.body}>
            Homeschool Sidekick supports voice-first sessions so your child can speak with the tutor while you still set the lesson focus, monitor progress, and guide the session privately when needed.
          </p>
        </section>

        <section className={styles.grid}>
          <article className="card">
            <h2 className={styles.heading}>What to look for in a voice tutor for kids</h2>
            <ul className={styles.list}>
              <li>Simple join flow with no child account required.</li>
              <li>Clear, patient responses suitable for younger learners.</li>
              <li>Hints-first teaching rather than instant answer dumps.</li>
              <li>Parent visibility, especially for homeschool use.</li>
              <li>Transcript history for later review and follow-up.</li>
            </ul>
          </article>

          <article className="card">
            <h2 className={styles.heading}>How parents keep control in a voice-first session</h2>
            <ol className={styles.list}>
              <li>Set the subject and learning goals before the child joins.</li>
              <li>Add private notes for the tutor (what to reinforce or avoid).</li>
              <li>Monitor the conversation while the child talks naturally.</li>
              <li>Send private nudges if your child needs a different approach.</li>
              <li>Review the transcript after the session to plan next steps.</li>
            </ol>
          </article>
        </section>

        <section className={`${styles.callout} card card--glass`}>
          <h2 className={styles.heading}>When a voice tutor is especially useful</h2>
          <p className={styles.body}>
            Voice-first tutoring is often a great fit when a child is still building typing skills, gets frustrated by writing every answer, or learns best through conversation and verbal reasoning.
          </p>
          <p className={styles.body}>
            It can also help parents run shorter, more frequent practice blocks during the day without turning every session into a typing exercise.
          </p>
        </section>

        <section className={`${styles.faq} card`} aria-labelledby="voice-tutor-faq-heading">
          <h2 id="voice-tutor-faq-heading" className={styles.heading}>Frequently asked questions</h2>

          <div className={styles.qa}>
            <h3 className={styles.question}>Is voice tutoring only for younger kids?</h3>
            <p className={styles.answer}>
              No. Older students can benefit too, especially when they need to talk through reasoning. But voice-first is particularly helpful for younger learners who are still building keyboard confidence.
            </p>
          </div>

          <div className={styles.qa}>
            <h3 className={styles.question}>Will my child still see a transcript?</h3>
            <p className={styles.answer}>
              The system keeps a transcript so sessions can be reviewed. Parents can use that transcript to check understanding, spot patterns, and plan what to reinforce next.
            </p>
          </div>

          <div className={styles.qa}>
            <h3 className={styles.question}>How do I keep a voice session on topic?</h3>
            <p className={styles.answer}>
              Set the daily focus before the session starts and use private parent notes to guide the tutor. That combination keeps the conversation aligned with your homeschool plan.
            </p>
          </div>

          <div className={styles.qa}>
            <h3 className={styles.question}>Can I use voice tutoring without giving up privacy controls?</h3>
            <p className={styles.answer}>
              Yes. Homeschool Sidekick is built with parent controls, transcript review, and privacy-focused workflows so families can supervise how AI tutoring is used.
            </p>
          </div>
        </section>

        <section className={`${styles.related} card`} aria-labelledby="voice-related-guides-heading">
          <h2 id="voice-related-guides-heading" className={styles.heading}>Related parent guides</h2>
          <p className={styles.body}>
            Start with the broader parent-guided AI homeschool guide, and add the math guide if you want a focused daily practice routine.
          </p>
          <div className="btn-row">
            <Link href="/ai-tutor-for-homeschool" className="btn btn--secondary">AI tutor for homeschool guide</Link>
            <Link href="/math-help-for-homeschool" className="btn btn--secondary">Math help for homeschool guide</Link>
            <Link href="/guides" className="btn btn--ghost">Browse all guides</Link>
          </div>
        </section>

        <section className={`${styles.cta} card card--elevated`}>
          <h2 className={styles.heading}>Try a voice-first tutoring session</h2>
          <p className={styles.body}>
            Start a parent session, set the subject, and have your child join with a code to begin a guided voice-first learning session.
          </p>
          <div className="btn-row">
            <Link href="/parent" className="btn btn--primary">Start as a parent</Link>
            <Link href="/child" className="btn btn--secondary">Join with a code</Link>
          </div>
        </section>
      </AppShell>
    </>
  );
}
