import { AppShell } from "../components/layout/AppShell.js";
import { buildMarketingMetadata } from "../../src/lib/seo.js";
import styles from "../privacy/page.module.css";

export const metadata = buildMarketingMetadata({
  title: "Billing Policy | Homeschool Sidekick",
  description:
    "Homeschool Sidekick billing policy covering trial terms, cancellation timing, refunds, and parent payment verification charges.",
  path: "/billing-policy"
});

export default function BillingPolicyPage() {
  return (
    <AppShell
      role="home"
      title="Billing Policy"
      subtitle="Last updated: February 24, 2026"
    >
      <article className={styles.prose}>
        <section>
          <h2 className={styles.heading}>1. Family Plan Pricing</h2>
          <p>
            Our family plan is <strong>$1.99 USD for the first month</strong>, then
            <strong> $9.99 USD per month</strong> for one parent account with unlimited child
            profiles, unless a valid promotion code applies.
          </p>
        </section>

        <section>
          <h2 className={styles.heading}>2. Introductory First Month</h2>
          <p>
            We offer an introductory first month at $1.99. The initial subscription payment is
            collected at signup and is used as part of our parental consent verification workflow.
          </p>
          <p>
            If you cancel before renewal, you will not be charged the next monthly subscription fee.
          </p>
        </section>

        <section>
          <h2 className={styles.heading}>3. Parent Billing Verification</h2>
          <p>
            We use the initial parent subscription payment transaction as part of our parental
            consent verification workflow before child profiles and tutoring sessions are enabled.
          </p>
        </section>

        <section>
          <h2 className={styles.heading}>4. Promotion Codes</h2>
          <p>
            Promotion codes may provide discounts, including trial modifications or ongoing
            discounts, subject to their terms, expiration, and redemption limits.
          </p>
        </section>

        <section>
          <h2 className={styles.heading}>5. Cancellation Policy</h2>
          <p>
            You can cancel anytime from the parent billing management portal. Cancellation usually
            applies at the end of the current trial or billing period. No future renewal charges
            will be made after cancellation takes effect.
          </p>
        </section>

        <section>
          <h2 className={styles.heading}>6. Refund Policy</h2>
          <p>
            Subscription charges are generally non-refundable once a billing period has started,
            except where required by law or when we choose to issue a courtesy refund.
          </p>
          <p>
            If you believe you were charged in error, contact us promptly through our{" "}
            <a href="/contact" className={styles.link}>
              Contact page
            </a>{" "}
            and include the email address used for your parent account.
          </p>
        </section>

        <section>
          <h2 className={styles.heading}>7. Customer Support</h2>
          <p>
            We provide customer support through our{" "}
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
