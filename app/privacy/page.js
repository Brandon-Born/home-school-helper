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
                            <strong>Account Information (Parents):</strong> When a parent signs
                            in using Google authentication, we receive and store the parent
                            name and email address for account creation, authentication, and
                            account-related communication.
                        </li>
                        <li>
                            <strong>Child Profiles:</strong> Parents may create child profiles
                            including first name, age, grade, and subjects, with optional
                            profile notes and special-needs notes. We do not require a child
                            email address.
                        </li>
                        <li>
                            <strong>Session Data (Child-Directed Content):</strong>
                            Conversations between the child and the AI tutor are temporarily
                            stored so the service can function and parents can review session
                            history. Child free-form text may include personal information
                            voluntarily shared during tutoring.
                        </li>
                        <li>
                            <strong>Persistent Identifiers:</strong> We process limited
                            technical information such as IP address and user agent for core
                            service security, abuse prevention, and operational auditing.
                        </li>
                        <li>
                            <strong>Voice Data (Optional Feature):</strong> If voice input is
                            enabled, audio is sent to our speech provider for transcription.
                            Raw voice recordings are not intentionally stored in our app
                            database after transcription is completed.
                        </li>
                    </ul>
                </section>

                <section>
                    <h2 className={styles.heading}>3. How We Use Your Data</h2>
                    <p>We use collected information solely to:</p>
                    <ul>
                        <li>Provide AI-assisted tutoring sessions</li>
                        <li>Allow parents to review and manage child sessions</li>
                        <li>Maintain security and prevent misuse</li>
                        <li>Improve system reliability and performance</li>
                    </ul>
                    <p>We do not:</p>
                    <ul>
                        <li>Sell personal information</li>
                        <li>Serve targeted advertising</li>
                        <li>Use children&apos;s personal information for behavioral profiling</li>
                    </ul>
                    <p>
                        We process children&apos;s data only to deliver tutoring services that
                        parents request and control.
                    </p>
                </section>

                <section>
                    <h2 className={styles.heading}>4. Data Retention</h2>
                    <p>
                        Session transcripts are <strong>automatically deleted after
                            30&nbsp;days</strong> unless deleted sooner through parent privacy
                        controls. Parent account data is retained while the account remains
                        active.
                    </p>
                    <p>
                        Parents may request deletion of account-associated data at any time.
                        We process deletion requests after verifying parent authorization and
                        subject to legal obligations.
                    </p>
                </section>

                <section>
                    <h2 className={styles.heading}>5. Children&rsquo;s Privacy &amp; Parental Consent</h2>
                    <p>
                        Homeschool Sidekick is designed for use by children under parental
                        supervision. Children do not create accounts — they join sessions
                        with short-lived codes provided by their parent.
                    </p>
                    <p>
                        Before creating a child profile or starting a session, the parent
                        must complete our parental consent checkpoint. In the current
                        implementation, consent is recorded as a parent self-attestation, with
                        consent status, policy version, timestamp, and request metadata logged
                        for auditing.
                    </p>
                    <p>
                        Parents can review child-data categories, request export or deletion,
                        and revoke consent for new child-data collection from the parent
                        console.
                    </p>
                </section>

                <section>
                    <h2 className={styles.heading}>6. Notice to Parents (COPPA)</h2>
                    <p>
                        We operate this service with COPPA-focused controls for child-directed
                        use, including parental consent gating before child profile creation
                        and session start, and parent rights workflows for review, deletion,
                        and consent revocation.
                    </p>
                    <p>
                        We do not condition a child&apos;s participation on providing more
                        personal information than is reasonably necessary to use tutoring
                        features.
                    </p>
                </section>

                <section>
                    <h2 className={styles.heading}>7. Third-Party Service Providers</h2>
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
                        We share personal information with these providers only as needed to
                        deliver the service. Each provider processes data under its own legal
                        terms and privacy commitments.
                    </p>
                    <p>
                        For Anthropic commercial API usage, Anthropic publicly states that API
                        inputs and outputs are not used to train its models by default unless
                        a customer explicitly opts in. We do not opt in child session data for
                        model training.
                    </p>
                </section>

                <section>
                    <h2 className={styles.heading}>8. Cookies &amp; Local Storage</h2>
                    <p>
                        We use essential cookies and <code>localStorage</code> for
                        authentication state and theme preferences. We do not use tracking
                        cookies or third-party analytics that identify individual users.
                    </p>
                </section>

                <section>
                    <h2 className={styles.heading}>9. Your Rights</h2>
                    <p>
                        Parents may request access to, correction of, export of, or deletion
                        of personal information associated with their account and child
                        profiles. Parents may also revoke consent for future child-data
                        collection.
                    </p>
                    <p>
                        We verify parent identity for sensitive data requests through
                        authenticated account access and, when needed, additional validation.
                    </p>
                </section>

                <section>
                    <h2 className={styles.heading}>10. Changes to This Policy</h2>
                    <p>
                        We may update this Privacy Policy from time to time. If we make
                        material changes, we will notify users through the application or by
                        email. The &ldquo;last updated&rdquo; date at the top of this page
                        reflects the most recent revision.
                    </p>
                </section>

                <section>
                    <h2 className={styles.heading}>11. Contact</h2>
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
