import Link from "next/link";
import { AppShell } from "../components/layout/AppShell.js";
import { buildMarketingMetadata, serializeJsonLd } from "../../src/lib/seo.js";
import styles from "./page.module.css";

export const metadata = buildMarketingMetadata({
  title: "AI Tutor for Homeschool Families | Homeschool Sidekick",
  description:
    "Learn how to use an AI tutor for homeschool learning while parents stay in control. Voice-first tutoring, private parent guidance, and hints-before-answers support.",
  path: "/ai-tutor-for-homeschool"
});

function buildFaqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Can an AI tutor work for homeschooling without replacing the parent?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Yes. The strongest setup is parent-guided AI tutoring: the parent sets the lesson focus, monitors the session, and adjusts direction while the AI handles patient practice and step-by-step explanations."
        }
      },
      {
        "@type": "Question",
        name: "Is Homeschool Sidekick designed to give answers or teach through hints?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Homeschool Sidekick is designed for hints-first tutoring. The tutor uses guiding questions and step-by-step support so children practice thinking instead of copying answers."
        }
      },
      {
        "@type": "Question",
        name: "Can younger homeschool students use voice instead of typing?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Yes. Homeschool Sidekick supports a voice-first workflow for younger learners, so they can talk to the tutor instead of relying only on typing."
        }
      }
    ]
  };
}

export default function AiTutorForHomeschoolPage() {
  const faqJsonLd = serializeJsonLd(buildFaqJsonLd());

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd }} />

      <AppShell
        role="home"
        title="AI tutor for homeschool families"
        subtitle="A practical, parent-guided way to use AI tutoring at home without giving up control of what your child learns."
      >
        <section className={`${styles.heroCard} card card--elevated`}>
          <h2 className={styles.heading}>Why homeschool parents look for an AI tutor</h2>
          <p className={styles.body}>
            Homeschooling often means switching roles all day: teacher, coach, scheduler, and parent. An AI tutor can help your child practice independently for short blocks, but only if it supports your goals instead of taking over the lesson.
          </p>
          <p className={styles.body}>
            Homeschool Sidekick is built for that exact use case. Parents choose the focus, share context, and stay in the loop while the tutor gives patient, step-by-step support by voice or keyboard.
          </p>
        </section>

        <section className={styles.grid}>
          <article className="card">
            <h2 className={styles.heading}>What makes an AI tutor useful for homeschool?</h2>
            <ul className={styles.list}>
              <li>It reinforces your lesson plan instead of inventing a new one.</li>
              <li>It gives hints and guided steps, not just final answers.</li>
              <li>It is easy for young learners to use (voice support matters).</li>
              <li>It gives parents visibility and control over the conversation.</li>
              <li>It respects privacy and limits unnecessary data retention.</li>
            </ul>
          </article>

          <article className="card">
            <h2 className={styles.heading}>How Homeschool Sidekick fits into your day</h2>
            <ol className={styles.list}>
              <li>Parent signs in and sets today&apos;s subject and goals.</li>
              <li>Child joins with a short code (no child account needed).</li>
              <li>AI tutor guides practice with questions and explanations.</li>
              <li>Parent monitors progress and can send private nudges.</li>
              <li>Family reviews the transcript later if needed.</li>
            </ol>
          </article>
        </section>

        <section className={`${styles.callout} card card--glass`}>
          <h2 className={styles.heading}>Who this works best for</h2>
          <p className={styles.body}>
            Families who want an AI tutor to support practice time, reinforce a lesson, or give their child another patient voice to learn from while the parent still directs the overall plan.
          </p>
          <p className={styles.body}>
            It is especially useful when a child benefits from repeated explanations, voice interaction, or short guided sessions between parent-led instruction blocks.
          </p>
        </section>

        <section className={`${styles.faq} card`} aria-labelledby="ai-tutor-faq-heading">
          <h2 id="ai-tutor-faq-heading" className={styles.heading}>Frequently asked questions</h2>

          <div className={styles.qa}>
            <h3 className={styles.question}>Can an AI tutor replace a homeschool parent?</h3>
            <p className={styles.answer}>
              It shouldn&apos;t. The best use is support, not replacement. Parents know the child, set the learning goals, and decide what the tutor should emphasize. Homeschool Sidekick is designed around that parent-guided model.
            </p>
          </div>

          <div className={styles.qa}>
            <h3 className={styles.question}>What subjects can I use it for?</h3>
            <p className={styles.answer}>
              Families commonly start with math, reading support, and guided practice in core subjects. The key is setting the daily focus clearly so the tutor stays aligned with your plan.
            </p>
          </div>

          <div className={styles.qa}>
            <h3 className={styles.question}>How do you prevent answer-dumping?</h3>
            <p className={styles.answer}>
              The tutor is designed to favor hints and step-by-step guidance first. Parents can also steer sessions with private notes when a child needs a different approach.
            </p>
          </div>

          <div className={styles.qa}>
            <h3 className={styles.question}>Can younger kids use it without a lot of typing?</h3>
            <p className={styles.answer}>
              Yes. The workflow supports voice-first tutoring so younger learners can speak and listen, which is often a better fit than typing everything.
            </p>
          </div>
        </section>

        <section className={`${styles.related} card`} aria-labelledby="ai-related-guides-heading">
          <h2 id="ai-related-guides-heading" className={styles.heading}>Related parent guides</h2>
          <p className={styles.body}>
            If your child learns better by talking than typing, pair this with our voice-first guide for choosing and using a voice tutor for kids.
          </p>
          <div className="btn-row">
            <Link href="/voice-tutor-for-kids" className="btn btn--secondary">Voice tutor for kids guide</Link>
            <Link href="/" className="btn btn--ghost">Back to homepage</Link>
          </div>
        </section>

        <section className={`${styles.cta} card card--elevated`}>
          <h2 className={styles.heading}>Try a parent-guided AI tutoring workflow</h2>
          <p className={styles.body}>
            Start a session as a parent, set the lesson focus, and let your child join with a short code.
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
