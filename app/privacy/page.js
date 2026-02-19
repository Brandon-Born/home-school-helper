import { AppShell } from "../components/layout/AppShell.js";
import styles from "./page.module.css";

export const metadata = {
    title: "Privacy Policy | Homeschool Sidekick",
    description:
        "Read the Homeschool Sidekick privacy policy. Learn how we collect, use, and protect your data — including our commitment to children's privacy."
};

export default function PrivacyPage() {
    return (
        <AppShell
            role="home"
            title="Privacy Policy"
            subtitle="Last updated: February 19, 2026"
        >
            <article className={styles.prose}>
                <section>
                    <h2 className={styles.heading}>1. Introduction</h2>
                    <p>
                        Homeschool Sidekick (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or
                        &ldquo;us&rdquo;) is operated by <strong>Freyr And Sons LLC</strong>.
                        This Privacy Policy describes how we collect, use, and safeguard
                        information when you use our web application.
                    </p>
                </section>

                <section>
                    <h2 className={styles.heading}>2. Information We Collect</h2>
                    <ul>
                        <li>
                            <strong>Account data:</strong> When a parent signs in with Google,
                            we receive your name and email address for authentication purposes.
                        </li>
                        <li>
                            <strong>Child profiles:</strong> Parents may create child profiles
                            containing a display name and grade level. No child email or
                            account is required.
                        </li>
                        <li>
                            <strong>Session transcripts:</strong> Conversations between the
                            child and the AI tutor are stored temporarily so parents can review
                            them.
                        </li>
                        <li>
                            <strong>Voice data:</strong> If voice input is used, audio is
                            processed for speech-to-text conversion and is not stored after
                            processing.
                        </li>
                    </ul>
                </section>

                <section>
                    <h2 className={styles.heading}>3. How We Use Your Data</h2>
                    <p>We use collected information solely to:</p>
                    <ul>
                        <li>Provide and improve the tutoring experience</li>
                        <li>Allow parents to manage sessions and review transcripts</li>
                        <li>Communicate with you about your account or our services</li>
                    </ul>
                    <p>
                        We <strong>do not</strong> sell your data, serve ads, or use your
                        information for marketing without consent.
                    </p>
                </section>

                <section>
                    <h2 className={styles.heading}>4. Data Retention</h2>
                    <p>
                        Session transcripts are <strong>automatically deleted after
                            30&nbsp;days</strong>. Parent account data is retained as long as the
                        account remains active. You may request deletion of your account and
                        all associated data at any time by contacting us.
                    </p>
                </section>

                <section>
                    <h2 className={styles.heading}>5. Children&rsquo;s Privacy</h2>
                    <p>
                        Homeschool Sidekick is designed for use by children under parental
                        supervision. Children do not create accounts — they join sessions
                        with short-lived codes provided by their parent. We do not knowingly
                        collect personal information directly from children. All data
                        collection is initiated and controlled by the parent.
                    </p>
                </section>

                <section>
                    <h2 className={styles.heading}>6. Third-Party Services</h2>
                    <p>
                        We use the following third-party services to operate Homeschool
                        Sidekick:
                    </p>
                    <ul>
                        <li>
                            <strong>Supabase</strong> — Authentication and database hosting
                        </li>
                        <li>
                            <strong>Anthropic</strong> — AI tutoring model
                        </li>
                        <li>
                            <strong>Google Cloud</strong> — Speech-to-text and text-to-speech
                            (optional, when voice features are used)
                        </li>
                        <li>
                            <strong>Vercel</strong> — Application hosting
                        </li>
                    </ul>
                    <p>
                        Each provider processes data in accordance with their own privacy
                        policies and applicable laws.
                    </p>
                </section>

                <section>
                    <h2 className={styles.heading}>7. Cookies &amp; Local Storage</h2>
                    <p>
                        We use essential cookies and <code>localStorage</code> for
                        authentication state and theme preferences. We do not use tracking
                        cookies or third-party analytics that identify individual users.
                    </p>
                </section>

                <section>
                    <h2 className={styles.heading}>8. Your Rights</h2>
                    <p>
                        You may request access to, correction of, or deletion of your
                        personal data at any time. To make a request, please contact us
                        using the information below.
                    </p>
                </section>

                <section>
                    <h2 className={styles.heading}>9. Changes to This Policy</h2>
                    <p>
                        We may update this Privacy Policy from time to time. If we make
                        material changes, we will notify users through the application or by
                        email. The &ldquo;last updated&rdquo; date at the top of this page
                        reflects the most recent revision.
                    </p>
                </section>

                <section>
                    <h2 className={styles.heading}>10. Contact</h2>
                    <p>
                        If you have questions about this Privacy Policy or your data, please
                        reach out through our{" "}
                        <a href="/contact" className={styles.link}>
                            Contact page
                        </a>.
                    </p>
                    <p className={styles.company}>
                        Freyr And Sons LLC
                    </p>
                </section>
            </article>
        </AppShell>
    );
}
