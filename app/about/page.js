import { AppShell } from "../components/layout/AppShell.js";
import styles from "./page.module.css";

export const metadata = {
    title: "About Us | Homeschool Sidekick",
    description:
        "Learn about Homeschool Sidekick — an AI-powered tutor built by Freyr And Sons LLC that helps homeschool parents guide their children through patient, step-by-step learning."
};

export default function AboutPage() {
    return (
        <AppShell
            role="home"
            title="About Homeschool Sidekick"
            subtitle="Patient AI tutoring, guided by parents who know their kids best."
        >
            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Our Mission</h2>
                <p className={styles.body}>
                    Homeschool Sidekick was created to solve a real problem: homeschool
                    parents want quality, one-on-one academic help for their kids — but
                    they also want to stay in control. We built an AI tutor that gives
                    patient, step-by-step guidance while letting parents steer the lesson,
                    monitor every conversation, and jump in with private hints at any time.
                </p>
            </section>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>How It Works</h2>
                <p className={styles.body}>
                    Parents sign in, pick a subject, and start a session. Kids join with a
                    short code — no account required — and talk to their AI tutor by voice
                    or keyboard. The tutor gives hints and guiding questions first, never
                    raw answers. Parents can watch the full conversation in real time and
                    send private nudges that shape the lesson without the child knowing.
                </p>
            </section>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Built by Freyr And Sons LLC</h2>
                <p className={styles.body}>
                    Homeschool Sidekick is a product of{" "}
                    <strong>Freyr And Sons LLC</strong>, a family run business who homeschools
                    our child outside of Dallas, TX. This site was built first as a hobby project for our
                    family and after seeing success with it, we decided to share it with the world.

                    Unfortunately, we have daily struggles with school and learning like other kids. We created
                    this to help our child have a second voice reinforcing
                    what we are teaching them. As most parents know, kids tend to listen to other adults
                    better than their parents, like coaches. We aren't comfortable with just hiring over the reigns
                    to AI fully, and hiring a tutor is not an option for us. So we built this tool where parents
                    are still in the drivers seat and can see and steer the conversation with the tutor.
                </p>
            </section>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Our Principles</h2>
                <ul className={styles.principlesList}>
                    <li>
                        <strong>Hints first, answers second.</strong> Kids learn by doing,
                        not copying.
                    </li>
                    <li>
                        <strong>Parents stay in the loop.</strong> Full transcripts, live
                        monitoring, and invisible guidance.
                    </li>
                    <li>
                        <strong>Privacy by default.</strong> Session transcripts are
                        automatically deleted after 30 days. No ads, no data selling, no
                        tracking.
                    </li>
                    <li>
                        <strong>Voice-friendly for young learners.</strong> Kids press a
                        button and talk — no typing required.
                    </li>
                </ul>
            </section>
        </AppShell>
    );
}
