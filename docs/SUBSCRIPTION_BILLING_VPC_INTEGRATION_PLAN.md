# Subscription Billing + COPPA VPC Integration Plan

Last updated: 2026-02-23
Owner: Product + Engineering (+ Legal review required)
Status: Proposed plan

## Decision (2026-02-23)
- Selected provider: **Stripe Billing**

## Goal
- Add a parent-paid credit card subscription with:
- a first 7 days free trial
- then `$10/month` per family (one parent account, unlimited kids)
- billing flow support for COPPA verifiable parental consent (VPC) for the parent account

## Executive Recommendation
- **Recommended service: Stripe Billing (Stripe Checkout + Billing Portal + Webhooks).**

Why this is the best fit for this repo right now:
- This app already has a strong parent/child separation and COPPA consent gating in place; Stripe lets us replace only the consent grant path rather than redesign auth or the parent console.
- Stripe provides first-party hosted Checkout for subscriptions, a hosted Billing Portal, trial support, and robust webhook events for server-authoritative state changes.
- The current stack (Next.js App Router + Supabase) is a straightforward fit for Stripe’s server-side webhook pattern and metadata-based parent account linking.

When a competitor may be better:
- **Paddle Billing** if near-term priority becomes merchant-of-record handling for global sales tax/VAT/compliance operations.
- **Braintree** if you strongly prefer PayPal/Braintree merchant setup and accept more custom billing-management UI work.

## Important COPPA Note (Free Trial vs VPC)
- A payment provider can support VPC, but it does **not** make the product COPPA-compliant by itself.
- COPPA still requires direct notice, auditable consent records, parental rights workflows, and policy coverage.
- The FTC FAQ still describes card-based VPC as collecting a debit/credit card number **in connection with a monetary transaction**.
- The current eCFR text for `16 CFR 312.5` (amended April 22, 2025) now says **in connection with a transaction**.
- Because your plan includes a free first week, legal should confirm whether “card on file for a free trial subscription checkout” is sufficient for your chosen VPC method, or whether you should use a small reversible verification charge/authorization before enabling child data collection.

## Current Repo Findings (Why this plan is low-risk)
- Parent/child household model already exists in Supabase (`parents`, `children`, `sessions`).
- COPPA consent state is already modeled (`pending` / `granted` / `revoked`) and enforced before child creation/session start.
- The current gap is that consent is granted via **self-attestation**, not billing-backed verification.

Current touchpoints to replace/extend:
- `app/api/privacy/consent/route.js` supports `grant`/`revoke` directly from the parent UI.
- `src/server/session-foundation/coppa-consent-service.js` records consent events with method `parent_self_attestation`.
- `app/parent/components/CoppaConsentPanel.js` presents the self-attestation consent button.
- `app/parent/hooks/useParentConsole.js` calls the consent route on button click.
- `src/server/session-foundation/children-service.js` and `src/server/session-foundation/session-service.js` already enforce consent before collection/use.

## Service Comparison (Shortlist)

### 1. Stripe Billing (Recommended)
Pros
- Hosted subscription Checkout (low PCI scope)
- Hosted Billing Portal for card updates/cancel/resume/payment history
- Native subscription trials
- Strong webhook model for server-authoritative activation and renewals
- Easy metadata linking (`parent_id`, policy version, consent attempt id)
- Very common Next.js integration path

Cons
- You remain merchant of record (tax/compliance operations remain on you)
- COPPA-specific workflows (direct notice, VPC logging language, revocation policy) must be implemented in your app

Fit for this repo
- Best balance of speed, control, and low implementation risk.

### 2. Paddle Billing (Alternative if MoR is a priority)
Pros
- Merchant of record model can reduce tax/remittance operations burden
- Subscription trials, customer portal, and webhooks are available

Cons
- More opinionated subscription model and less direct control than Stripe for custom consent-linked flows
- Additional vendor/process complexity for a small U.S.-first rollout

Fit for this repo
- Strong alternative only if tax/compliance operations outsourcing is worth the tradeoff now.

### 3. Braintree (Alternative if PayPal/Braintree is a strategic requirement)
Pros
- Supports recurring subscriptions, trial periods, and subscription lifecycle handling
- Familiar option if your business already uses PayPal/Braintree

Cons
- In this repo, you will likely build more of the customer subscription-management UX yourself compared with Stripe Billing Portal
- More custom implementation effort for a fast launch

Fit for this repo
- Viable, but not the fastest path to production for your current architecture.

## Recommended Product/Billing Model
- **Plan name:** Family Plan
- **Price:** `$10/month`
- **Billing unit:** 1 household subscription per parent account (not per child)
- **Children limit:** Unlimited (app-enforced)
- **Trial:** 7-day free trial
- **Access during trial:** Full parent + child functionality (subject to consent and policy gates)
- **Post-trial:** Auto-renew monthly unless canceled
- **Cancellation behavior:** Keep access through current paid period or trial end; retain parent privacy rights access after cancellation

## Proposed COPPA + Billing Design (Recommended Flow)

### Parent onboarding / consent flow
1. Parent signs in with Google (existing flow).
2. Parent sees COPPA direct notice + plan summary (`7 days free`, then `$10/month`).
3. Parent clicks `Start free week`.
4. App creates a server-side Stripe Checkout Session for subscription signup.
5. Parent completes hosted Stripe Checkout (card entered by parent).
6. App waits for Stripe webhook(s) and **does not trust the client redirect alone**.
7. Webhook marks billing status and (after legal-approved condition) grants COPPA consent with billing-backed method.
8. Parent console refresh shows `Consent active` + billing status/trial end date.

### Legal decision branch (must be explicit)
- **Option A (simpler UX, legal review required):** Grant consent after successful free-trial subscription signup with parent card on file.
- **Option B (more conservative COPPA posture):** Require a small reversible card verification transaction/authorization before granting consent, then start the 7-day trial subscription.

Recommendation
- Implement the code to support **Option A now** and keep a feature-flagged path for **Option B** if legal requires stricter verification.

## Repo-Specific Implementation Plan

### Phase 1: Data Model + State (Supabase)
Add billing state without overloading the existing consent tables.

New table (recommended): `billing_subscriptions`
- `id uuid pk`
- `parent_id uuid not null references parents(id)`
- `provider text not null` (start with `stripe`)
- `provider_customer_id text not null`
- `provider_subscription_id text unique`
- `provider_price_id text not null`
- `status text not null` (`incomplete` | `trialing` | `active` | `past_due` | `canceled` | `unpaid` | `incomplete_expired`)
- `trial_start_at timestamptz`
- `trial_end_at timestamptz`
- `current_period_start_at timestamptz`
- `current_period_end_at timestamptz`
- `cancel_at_period_end boolean not null default false`
- `canceled_at timestamptz`
- `last_webhook_event_id text`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

New table (recommended): `billing_webhook_events`
- `id uuid pk`
- `provider text not null`
- `provider_event_id text unique not null`
- `event_type text not null`
- `processed_at timestamptz`
- `payload jsonb not null`
- `created_at timestamptz default now()`

Optional addition to `parent_consents`
- `verification_reference text` (e.g., Stripe event id / subscription id)
- Or store this in `metadata jsonb` if you want flexibility

Parent profile denormalization (optional but useful)
- `billing_status text`
- `billing_provider text`
- `billing_trial_ends_at timestamptz`

RLS
- Parent read access to their own `billing_subscriptions`
- No direct client writes; webhook route writes via service role

### Phase 2: Stripe Service Layer + Env Validation
Add server-side Stripe utilities and config checks.

New env vars (minimum)
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID_FAMILY_MONTHLY`
- `STRIPE_BILLING_PORTAL_CONFIG_ID` (optional initially, recommended)
- `NEXT_PUBLIC_APP_URL` (if not already standardized for redirects)

Code additions (suggested)
- `src/server/stripe-config.js` (env parsing + validation)
- `src/server/stripe-client.js` (singleton Stripe SDK client)
- `src/server/billing-service.js` (provider-agnostic app logic, Stripe-backed first)

Also update
- `scripts/validate-env.mjs` to validate Stripe config when billing is enabled

### Phase 3: Billing API Routes (Next.js App Router)
Add parent-authenticated billing routes and an unauthenticated Stripe webhook route.

Suggested routes
- `POST /api/billing/checkout-session`
  - Requires `requireParentContext`
  - Creates/looks up Stripe customer for the parent
  - Creates Stripe Checkout Session in `subscription` mode
  - Uses 7-day trial and the configured family price
  - Sets metadata (`parent_id`, `coppa_policy_version`, `consent_intent_version`)
  - Returns `{ url }`

- `POST /api/billing/portal-session`
  - Requires `requireParentContext`
  - Creates Stripe Billing Portal session
  - Returns `{ url }`

- `GET /api/billing/subscription`
  - Requires `requireParentContext`
  - Returns normalized billing state for parent console rendering

- `POST /api/billing/webhook`
  - Verifies Stripe signature with raw request body
  - Stores event idempotently in `billing_webhook_events`
  - Updates `billing_subscriptions`
  - Grants/revokes COPPA consent only via server-side policy transitions (not client callback)

Webhook events to handle first
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

### Phase 4: Replace Self-Attestation in Parent UI
Replace the current consent CTA with billing-backed activation.

UI changes
- `app/parent/components/CoppaConsentPanel.js`
  - Replace `I am the parent or legal guardian` button with `Start free week`
  - Show plan summary (`7-day free trial`, then `$10/month`)
  - Show billing/trial status once available
  - Keep `Revoke consent` action, but separate it from `Cancel subscription` to avoid conflating legal consent and billing status

- `app/parent/hooks/useParentConsole.js`
  - Replace `grantCoppaConsent()` self-attestation request with:
  - `startBillingCheckout()` -> call `POST /api/billing/checkout-session` -> `window.location = url`
  - Add `openBillingPortal()` action
  - Fetch billing state in the same initial parent-data load bundle (or a new request)

UX copy changes
- Make it explicit that the parent is entering payment details for a family subscription and authorizing parental consent.
- Show direct notice link and privacy policy link before checkout.

### Phase 5: Consent State Transition Rules (Server-Authoritative)
Keep consent and billing separate but linked.

Recommended rules
- `pending` -> `granted` only from verified billing webhook path (plus legal-approved condition)
- `granted` -> `revoked` only from parent action (existing route), not automatically on payment failure
- Subscription cancellation/failure should block new paid usage (business rule), but should not erase prior consent records

Recommended consent method values
- `stripe_subscription_trial_signup`
- `stripe_subscription_active_charge`
- `stripe_card_verification_charge` (if conservative option enabled)

### Phase 6: Testing (Unit + Route + E2E)
Unit tests
- Stripe config parsing / missing env behavior
- Billing state normalization and transition logic
- Idempotent webhook processing

Route tests
- `POST /api/billing/checkout-session` requires parent auth
- `POST /api/billing/webhook` rejects invalid signatures
- Webhook processing updates subscription + consent state correctly
- Existing consent route tests updated to remove direct `grant` path (or restrict it behind non-prod flag)

Playwright / integration tests
- Parent sees trial/paywall CTA when consent missing
- Checkout-session creation redirects to Stripe URL (mocked in test)
- After simulated webhook, parent can create child and start sessions
- Canceled/past_due states block session start but preserve privacy tools

### Phase 7: Ops, Monitoring, and Rollout
Operational requirements
- Webhook endpoint deployed with stable public URL
- Stripe webhook retry behavior tested
- Alerting/logging for webhook processing failures
- Admin runbook for reconciling billing vs consent mismatches

Rollout plan
1. Ship schema + webhook ingestion + billing state read APIs behind feature flag
2. Add Stripe test mode end-to-end in staging
3. Switch parent UI CTA from self-attestation to billing checkout in staging
4. Validate webhook-driven consent grant and gating behavior
5. Legal signoff on VPC wording/trigger
6. Enable in production

## Migration Strategy From Current Self-Attestation
- Disable or hide direct `grant` in production once Stripe-backed path is ready.
- Keep `revoke` available.
- For any existing parent records with `coppa_consent_method='parent_self_attestation'`, decide one of:
- Require billing verification before next child/session action (recommended)
- Grandfather for beta accounts until a cutoff date

## Risks / Decisions To Resolve Before Build
1. **Legal VPC trigger for free trial:** Is card-on-file trial signup enough, or is a small verification transaction required?
2. **Access policy on failed payment:** Block only new sessions, or also active parent management actions (privacy/export/delete should remain available)?
3. **Cancellation and consent relationship:** Cancel subscription should not automatically revoke consent, but confirm this policy with counsel.
4. **International rollout timing:** If non-U.S. launch is near-term, reconsider Paddle (MoR) before implementation starts.

## Suggested Acceptance Criteria (v1)
- Parent can start a 7-day free trial and enter a credit card via hosted checkout.
- Parent sees billing status/trial end date in the parent console.
- COPPA consent is granted only by server-side webhook path, not by client button click.
- Child profile creation and session start remain blocked until consent is granted.
- After trial, successful billing keeps access; failed/canceled subscription blocks new paid usage.
- Parent can still review/export/delete/revoke after cancellation.

## Source Notes (for provider/COPPA comparisons)
- FTC COPPA FAQ: https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions
- eCFR `16 CFR Part 312` (`312.5` parental consent): https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-312
- Stripe Checkout subscriptions: https://docs.stripe.com/payments/checkout/build-subscriptions
- Stripe Billing Portal: https://docs.stripe.com/customer-management
- Stripe subscription trials: https://docs.stripe.com/billing/subscriptions/trials
- Stripe webhooks (subscriptions): https://docs.stripe.com/billing/subscriptions/webhooks
- Paddle Billing overview (Merchant of Record): https://developer.paddle.com/build
- Paddle trial periods: https://developer.paddle.com/build/subscriptions/offer-free-trials-promotions-coupons/trial-periods
- Paddle customer portal: https://developer.paddle.com/concepts/customer-portal/overview
- Paddle webhooks overview: https://developer.paddle.com/webhooks/overview
- Braintree subscriptions overview: https://developer.paypal.com/braintree/docs/guides/recurring-billing/subscriptions/overview
- Braintree subscriptions create (trial fields): https://developer.paypal.com/braintree/docs/reference/request/subscription/create/

This is an engineering planning document, not legal advice.
