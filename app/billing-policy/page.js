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
            Our standard family plan is <strong>$10 USD per month</strong> for one parent
            account with unlimited child profiles, unless a valid promotion code applies.
          </p>
        </section>

        <section>
          <h2 className={styles.heading}>2. 7-Day Free Trial</h2>
          <p>
            We offer a 7-day free trial for the family plan. The free trial starts after parent
            payment verification succeeds and the parent completes subscription checkout.
          </p>
          <p>
            If you cancel before the trial ends, you will not be charged the monthly subscription
            fee.
          </p>
        </section>

        <section>
          <h2 className={styles.heading}>3. Parent Payment Verification</h2>
          <p>
            Before activating a free trial, we verify a parent payment method. This may appear as
            a $1.00 temporary authorization or a $1.00 refundable verification charge. Banks may
            display pending authorizations or reversals on different timelines.
          </p>
        </section>

        <section>
          <h2 className={styles.heading}>4. Promotion Codes</h2>
          <p>
            Promotion codes may provide discounts, including free trial modifications or ongoing
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
