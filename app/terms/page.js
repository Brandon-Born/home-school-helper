import { AppShell } from "../components/layout/AppShell.js";
import { buildMarketingMetadata } from "../../src/lib/seo.js";
import styles from "../privacy/page.module.css";

export const metadata = buildMarketingMetadata({
  title: "Terms of Service | Homeschool Sidekick",
  description:
    "Homeschool Sidekick terms of service, including family subscription terms, trial terms, cancellation, and acceptable use.",
  path: "/terms"
});

export default function TermsPage() {
  return (
    <AppShell
      role="home"
      title="Terms of Service"
      subtitle="Last updated: February 24, 2026"
    >
      <article className={styles.prose}>
        <section>
          <h2 className={styles.heading}>1. Overview</h2>
          <p>
            Homeschool Sidekick is operated by <strong>Freyr And Sons LLC</strong>. These
            Terms govern your use of the Homeschool Sidekick website and tutoring service.
          </p>
        </section>

        <section>
          <h2 className={styles.heading}>2. Parent-Controlled Use</h2>
          <p>
            Homeschool Sidekick is designed for parent-supervised use. Children do not create
            accounts directly. Parents create and manage child profiles and control session access.
          </p>
        </section>

        <section>
          <h2 className={styles.heading}>3. Family Subscription</h2>
          <p>
            The current family plan includes one parent account with support for unlimited child
            profiles under that parent account, subject to fair use and service availability.
          </p>
          <p>
            Current standard pricing is <strong>$10 USD per month</strong> after a
            <strong> 7-day free trial</strong>, unless a valid promotion code applies.
          </p>
          <p>
            Pricing, features, and availability may change in the future. Any material billing
            changes will be presented before they take effect for new billing cycles.
          </p>
        </section>

        <section>
          <h2 className={styles.heading}>4. Parent Payment Method Verification</h2>
          <p>
            Before a free trial is activated, we verify a parent payment method as part of our
            parental consent workflow. You may see a $1.00 temporary authorization or refundable
            verification charge before the trial begins.
          </p>
        </section>

        <section>
          <h2 className={styles.heading}>5. Trial and Renewal</h2>
          <p>
            The 7-day trial begins only after parent payment verification succeeds and trial
            checkout is completed. After the trial ends, the subscription renews monthly unless
            canceled before renewal.
          </p>
        </section>

        <section>
          <h2 className={styles.heading}>6. Cancellation</h2>
          <p>
            You can cancel your subscription at any time through the billing management portal
            available in the parent console. Cancellation generally takes effect at the end of
            the current paid period or trial period, and you will not be charged for future
            renewal periods after cancellation takes effect.
          </p>
        </section>

        <section>
          <h2 className={styles.heading}>7. Refunds</h2>
          <p>
            Refund requests are handled according to our{" "}
            <a href="/billing-policy" className={styles.link}>
              Billing Policy
            </a>.
          </p>
        </section>

        <section>
          <h2 className={styles.heading}>8. Acceptable Use</h2>
          <p>
            You agree not to misuse the service, interfere with its operation, or attempt
            unauthorized access to accounts, sessions, or infrastructure.
          </p>
        </section>

        <section>
          <h2 className={styles.heading}>9. Contact</h2>
          <p>
            For billing or service questions, contact us through our{" "}
            <a href="/contact" className={styles.link}>
              Contact page
            </a>.
          </p>
          <p className={styles.company}>Freyr And Sons LLC</p>
        </section>
      </article>
    </AppShell>
  );
}
