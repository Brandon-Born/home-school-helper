import Link from "next/link";
import { AppShell } from "../components/layout/AppShell.js";
import {
  buildMarketingMetadata,
  getBreadcrumbJsonLd,
  serializeJsonLd
} from "../../src/lib/seo.js";
import styles from "./page.module.css";

export const metadata = buildMarketingMetadata({
  title: "Math Help for Homeschool Families | Homeschool Sidekick",
  description:
    "Parent-guided AI math help for homeschool families. Use voice-first tutoring, hints-before-answers coaching, and private parent guidance for daily math practice.",
  path: "/math-help-for-homeschool"
});

function buildFaqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How can I use AI for homeschool math help without my child copying answers?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Start by setting a narrow math goal for the session, then use a tutor that emphasizes hints and step-by-step reasoning. Parents should monitor sessions and redirect when the child needs more practice instead of a final answer."
        }
      },
      {
        "@type": "Question",
        name: "What ages can use voice-first math help?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Voice-first math help is especially useful for younger learners who can explain thinking out loud before they can type quickly, but older students can also benefit when they need to talk through multi-step problems."
        }
      },
      {
        "@type": "Question",
        name: "Can parents guide the AI tutor during math practice?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Yes. Homeschool Sidekick lets parents set the math focus, review the transcript, and send private nudges so the tutor reinforces the same strategy or method the parent is teaching."
        }
      }
    ]
  };
}

export default function MathHelpForHomeschoolPage() {
  const faqJsonLd = serializeJsonLd(buildFaqJsonLd());
  const breadcrumbJsonLd = serializeJsonLd(
    getBreadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Guides", path: "/guides" },
      { name: "Math Help for Homeschool", path: "/math-help-for-homeschool" }
    ])
  );

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd }} />

      <AppShell
        role="home"
        title="Math help for homeschool families"
        subtitle="Use parent-guided AI tutoring for daily math practice, step-by-step support, and voice-first coaching without giving up control of your teaching approach."
      >
        <section className={`${styles.heroCard} card card--elevated`}>
          <h2 className={styles.heading}>Why math is the first place many homeschool families want AI help</h2>
          <p className={styles.body}>
            Math practice can be the most time-intensive part of the homeschool day. Kids often need repeated explanations, patient step-by-step guidance, and quick feedback while they work through problems.
          </p>
          <p className={styles.body}>
            Homeschool Sidekick helps with that practice time while you stay in control. You set the math goal, the tutor guides with hints first, and your child can talk through thinking by voice instead of typing every step.
          </p>
        </section>

        <section className={styles.grid}>
          <article className="card">
            <h2 className={styles.heading}>What good AI math help looks like</h2>
            <ul className={styles.list}>
              <li>It asks guiding questions before revealing the final answer.</li>
              <li>It breaks multi-step problems into manageable chunks.</li>
              <li>It adapts explanations when the child gets stuck.</li>
              <li>It keeps the session aligned with your curriculum and method.</li>
              <li>It gives parents visibility into how the child is reasoning.</li>
            </ul>
          </article>

          <article className="card">
            <h2 className={styles.heading}>A parent-guided math practice workflow</h2>
            <ol className={styles.list}>
              <li>Choose today&apos;s math objective (for example: fractions, regrouping, or word problems).</li>
              <li>Tell the tutor what method or vocabulary you want reinforced.</li>
              <li>Let your child work through problems by voice or keyboard.</li>
              <li>Send private nudges if they need a slower pace or different approach.</li>
              <li>Review the transcript to spot what to reteach tomorrow.</li>
            </ol>
          </article>
        </section>

        <section className={`${styles.callout} card card--glass`}>
          <h2 className={styles.heading}>Where parents get the biggest benefit</h2>
          <p className={styles.body}>
            Families often use AI math help for independent practice blocks, warm-ups before parent-led instruction, and extra repetition after a lesson. It is especially helpful when a child needs more patience and repetition than the schedule allows in the moment.
          </p>
          <p className={styles.body}>
            Because parents can guide the tutor privately, you can keep math language and problem-solving methods consistent with your homeschool routine.
          </p>
        </section>

        <section className={`${styles.faq} card`} aria-labelledby="math-guide-faq-heading">
          <h2 id="math-guide-faq-heading" className={styles.heading}>Frequently asked questions</h2>

          <div className={styles.qa}>
            <h3 className={styles.question}>Can this help with math facts and computation practice?</h3>
            <p className={styles.answer}>
              Yes. Short guided sessions work well for math facts, computation fluency, and basic problem solving. Parents can keep the scope narrow so the tutor reinforces one skill at a time.
            </p>
          </div>

          <div className={styles.qa}>
            <h3 className={styles.question}>What about word problems?</h3>
            <p className={styles.answer}>
              Word problems are a strong use case because the tutor can ask the child to explain what the problem is asking, identify known values, and choose a strategy before calculating.
            </p>
          </div>

          <div className={styles.qa}>
            <h3 className={styles.question}>Can I keep the tutor from using a method we haven&apos;t taught yet?</h3>
            <p className={styles.answer}>
              Yes. Use private parent notes to tell the tutor which strategy, vocabulary, or level of support to use so the session stays aligned with your lesson plan.
            </p>
          </div>

          <div className={styles.qa}>
            <h3 className={styles.question}>Does voice-first work for math notation?</h3>
            <p className={styles.answer}>
              It can, especially for mental math and verbal reasoning. For notation-heavy work, families often combine voice explanations with occasional typed answers or written work off-screen.
            </p>
          </div>
        </section>

        <section className={`${styles.related} card`} aria-labelledby="math-related-guides-heading">
          <h2 id="math-related-guides-heading" className={styles.heading}>Related parent guides</h2>
          <p className={styles.body}>
            Start with the full parent-guided AI homeschool overview, then use the voice tutor guide if your child learns better by talking through math steps out loud.
          </p>
          <div className="btn-row">
            <Link href="/ai-tutor-for-homeschool" className="btn btn--secondary">AI tutor for homeschool guide</Link>
            <Link href="/voice-tutor-for-kids" className="btn btn--secondary">Voice tutor for kids guide</Link>
            <Link href="/guides" className="btn btn--ghost">Browse all guides</Link>
          </div>
        </section>

        <section className={`${styles.cta} card card--elevated`}>
          <h2 className={styles.heading}>Try a parent-guided math practice session</h2>
          <p className={styles.body}>
            Start a session as a parent, set the math goal, and let your child join with a short code for guided practice.
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
