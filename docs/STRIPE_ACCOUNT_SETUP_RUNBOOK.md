# Stripe Account Setup Runbook (Human Guide)

Last updated: 2026-02-24
Audience: Founder / Ops / PM / Engineer (Dashboard setup)
Status: Ready to use

## Purpose
Set up a Stripe account correctly for this app’s billing model:
- Family plan: `$1.99` first month, then `$9.99/month`
- One parent account per subscription, unlimited kids
- Single-step subscription checkout (initial paid signup transaction used for COPPA billing-backed consent workflow)
- Hosted Stripe Checkout + Stripe Billing Portal + webhooks

This runbook is the human/Dashboard companion to:
- `/Users/bborn/home-school-helper/docs/SUBSCRIPTION_BILLING_VPC_INTEGRATION_PLAN.md`

## Outcome Checklist (What “done” looks like)
- Stripe account activated (business details + payouts configured)
- Team access and 2FA configured
- Branding/public business info configured
- Product + monthly price created in **test mode** and **live mode**
- Customer portal configured in **test mode** and **live mode**
- Webhook endpoint created in **test mode** and **live mode**
- Required Stripe values copied into app environment variables
- Test subscription signup checkout + webhook + portal flow verified

## Important Warnings (Read First)
- Stripe has separate **test** and **live** modes. Settings, products, prices, portal configs, and webhooks are separate.
- Do not reuse test IDs in production.
- For this app, COPPA consent should be granted by the server after Stripe webhook verification (not by the client redirect alone).
- This app uses a simplified billing-backed COPPA flow: the initial paid subscription signup transaction is used in the server-authoritative consent workflow before child use is unlocked.

## Information You Should Gather Before Starting
- Legal business name and address
- Bank account for payouts
- Support email address (customer-facing)
- Public website URL (production)
- Terms of service URL
- Privacy policy URL
- Billing support contact (email and/or URL)
- Engineering owner for webhook endpoint and environment variables

## 1. Create and Activate the Stripe Account
1. Create a Stripe account and log in to the Dashboard.
2. Complete account activation/business verification steps.
3. Add payout bank account details.
4. Confirm your legal entity/business details are accurate.
5. Add public business information (name, website, support contact) because this appears in customer-facing Stripe surfaces.

Recommended settings to verify before proceeding:
- Business name matches your legal/customer-facing brand
- Support email is monitored
- Website URL points to your production site

## 2. Secure Dashboard Access (Do This Early)
1. Enable two-factor authentication (2FA) for the account owner.
2. If multiple people need access, invite team members instead of sharing login credentials.
3. Use least-privilege roles (Ops/Support/Developer/Admin as needed).
4. If you have a team, require 2FA for all users.

Minimum practical team split:
- 1 admin/owner (billing + account settings)
- 1 developer/admin (API keys, webhooks, logs)
- Optional support role (view customers/subscriptions, limited financial admin)

## 3. Configure Branding and Public Business Information
These settings affect Checkout, customer portal, receipts, and emails.

In Stripe Dashboard, configure:
- Logo/icon
- Brand color / accent color
- Public business name
- Support contact info
- Terms of service link
- Privacy policy link (if shown in the surfaces you enable)

Why this matters for your app:
- Parents need a clear, trustworthy billing experience when entering card details for a child-directed product.

## 4. Create the Subscription Product and Price (Test Mode First)
Switch to **test mode** first.

Create product:
- Product name: `Family Plan`
- Description: `One parent account, unlimited kids`

Create recurring price:
- Amount: `9.99 USD`
- Billing period: `Monthly`

Create intro coupon (optional, recommended to achieve `$1.99` first month automatically):
- Coupon type: fixed amount off
- Amount off: `8.00 USD`
- Duration: `Once`
- Copy coupon id into app env as `STRIPE_COUPON_ID_FIRST_MONTH_INTRO`
- Usage type: Fixed price (not metered)
- Quantity: Keep as standard; this app treats it as one household subscription (no seat quantity UI)

Notes for this app:
- You only need one monthly price for v1.
- Do not create per-child pricing.
- Copy and save the **test Price ID** (`price_...`).

Repeat in **live mode** and save the **live Price ID** separately.

Recommended internal naming convention
- `family_monthly_usd_10_test`
- `family_monthly_usd_10_live`

## 5. Configure Customer Portal (Test Mode First, Then Live)
This app will create portal sessions server-side and redirect parents to Stripe’s hosted portal.

In **test mode**, configure a default customer portal:

### Subscription management
Recommended for v1:
- `Cancel subscription`: **On**
- `Switch plan`: **Off** (you only have one plan)
- `Update quantities`: **Off** (not seat-based)
- `Promotion codes`: **Off** (unless you plan promos immediately)
- `Retention coupons`: Optional (Off for v1 is fine)

### Customer billing settings
Recommended:
- `Payment methods`: **On**
- `Billing information`: **On**
- Invoice history visible: **On**

### Portal customization
Set:
- Headline (simple, parent-friendly billing text)
- Terms of service link
- Default return URL (your app parent console, for example `/parent`)

Save the configuration, then note the portal configuration ID if you plan to pin a specific config in code (recommended).

Repeat the same setup in **live mode**.

## 6. Configure Intro Pricing / Subscription Messaging Settings
Your plan includes an **introductory first month price** (`$1.99`), then renews at `9.99/month`, so configure messaging/reminders carefully.

Recommended:
- Enable Stripe customer emails relevant to billing/subscription updates
- Ensure cancellation URL/flow is clear (customer portal or your app link)

Why this matters:
- Stripe handles subscription billing mechanics, but you are still responsible for compliant disclosures and cancellation transparency.

## 7. Document the Intro Pricing + COPPA Billing Policy (Canonical)
Approved policy for this app:
- Parent completes the initial hosted subscription checkout payment transaction (`$1.99` first month offer)
- App grants COPPA consent after webhook processing of the completed paid checkout
- Subscription renews at `9.99/month` unless canceled

This policy should be reflected in:
- Parent-facing direct notice copy
- Engineering webhook logic
- Audit trail / consent method labels

## 8. API Keys: Create, Store, and Share Safely
Use the Stripe API Keys page in the Dashboard.

For this app, you will need at minimum:
- `STRIPE_SECRET_KEY` (server-side only)
- `STRIPE_WEBHOOK_SECRET` (from each webhook endpoint)
- `STRIPE_PRICE_ID_FAMILY_MONTHLY`
- `STRIPE_PARENT_VERIFICATION_AMOUNT_CENTS` (for example `100` for `$1.00`)
- `STRIPE_PARENT_VERIFICATION_CURRENCY` (for example `usd`)
- `STRIPE_BILLING_PORTAL_CONFIG_ID` (recommended)

Notes:
- Never put a secret key in frontend code.
- Save live keys immediately when Stripe shows them (Stripe may not show live secret keys again later).
- Keep test and live values clearly labeled.

Recommended storage:
- Password manager / secrets manager
- Vercel project environment variables (for deployment)

## 9. Create Webhook Endpoints (Test Mode and Live Mode)
Your app depends on webhook-driven billing state and COPPA consent state changes.

### Endpoint URL (production example)
- `https://YOUR_DOMAIN/api/billing/webhook`

### Endpoint URL (local/staging)
- Use your staging URL first
- For local development, engineers can use Stripe CLI forwarding while building

### Event types to subscribe to (v1)
Subscribe to at least:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

Recommended additional visibility events (optional)
- `invoice.upcoming`
- `customer.updated`

After creating the endpoint:
1. Reveal/copy the webhook signing secret (`whsec_...`)
2. Store it as the correct environment variable for that environment
3. Label the endpoint clearly (`Home School Helper Billing Webhook - Test`, etc.)

Important:
- Create separate webhook endpoints in **test** and **live** mode.

## 10. Map Stripe Values into This App’s Environment Variables
The app plan expects these environment variables.

### Required (billing integration)
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID_FAMILY_MONTHLY`

### Recommended
- `STRIPE_BILLING_PORTAL_CONFIG_ID`
- `NEXT_PUBLIC_APP_URL`

### Example mapping sheet (keep internal)
- Test secret key -> Vercel Preview / local `.env.local`
- Test webhook secret -> Vercel Preview / local `.env.local`
- Test price id -> Vercel Preview / local `.env.local`
- Test portal config id -> Vercel Preview / local `.env.local`
- Live secret key -> Vercel Production env
- Live webhook secret -> Vercel Production env
- Live price id -> Vercel Production env
- Live portal config id -> Vercel Production env

## 11. Test Mode Validation (Before Any Live Setup)
Run these tests in **test mode**:

1. Start checkout from the app (or test endpoint) and confirm redirect to Stripe Checkout.
2. Start the subscription checkout and confirm parents see the introductory price and card entry form.
3. Complete subscription checkout with a Stripe test card (for example `4242 4242 4242 4242`).
4. Confirm your app receives webhook events and grants COPPA consent after webhook processing (not just return redirect).
5. Confirm the parent console now shows subscription active/trialing access without a separate verification step.
6. Confirm Checkout shows:
- correct plan name
- introductory first-month pricing of `$1.99` (via coupon/discount)
- future recurring charge of `$9.99/month`
7. Optionally test a promotion code (including tester/friends/family `100% off` code) in subscription checkout.
8. Confirm your app receives webhook events and marks subscription state/access details.
9. Confirm parent can create a child and start a session after consent is granted and subscription access is active.
10. Open Billing Portal from the app and confirm:
- payment method management works
- cancellation flow is visible
- return URL comes back to the app
11. Test a failed renewal scenario and confirm app behavior matches policy (for example, block new sessions).

## 12. Live Mode Go-Live Checklist
Before enabling production billing:
- Live product + price created (`$10/month`)
- Live portal configured
- Live webhook endpoint configured and secret stored
- Production env vars set
- DNS/domain and HTTPS working for webhook endpoint
- Billing/support contact monitored
- Trial disclosures and cancellation flow reviewed
- Legal approval captured for COPPA VPC trigger policy
- A test purchase in live mode completed (real small controlled internal purchase)

## 13. Common Mistakes (Avoid These)
- Creating product/price only in test mode and forgetting live mode
- Copying a test `price_...` into production env
- Not configuring the customer portal in live mode
- Using client redirect success as the source of truth instead of webhooks
- Forgetting to store the live secret key when first revealed
- Subscribing to too few webhook events and missing billing state transitions
- Allowing plan switching/quantity changes in portal when the app only supports one household plan

## 14. Operational Ownership (Who Does What)
Suggested ownership split:
- Founder/Ops: account activation, bank payouts, public business info, branding
- Product/Legal: trial disclosure text, cancellation wording, COPPA notice alignment
- Engineer: API keys, portal config ID, webhooks, env vars, app integration, test verification

## 15. Recordkeeping (Recommended for Compliance/Audit Readiness)
Keep an internal record of:
- Stripe account owner and admins
- Test and live price IDs
- Test and live webhook endpoint URLs
- Test and live webhook secrets storage location (not the raw secret in docs)
- Customer portal configuration ID(s)
- Date legal approved trial + VPC policy
- Date production billing launched

## Reference Links (Official Stripe Docs)
- [API keys](https://docs.stripe.com/keys)
- [Build a subscriptions integration with Checkout](https://docs.stripe.com/payments/checkout/build-subscriptions)
- [Create Checkout Session (API reference)](https://docs.stripe.com/api/checkout/sessions/create)
- [Subscription trials](https://docs.stripe.com/billing/subscriptions/trials)
- [Subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks)
- [Customer portal integration](https://docs.stripe.com/customer-management/integrate-customer-portal)
- [Configure customer portal](https://docs.stripe.com/customer-management/configure-portal)
- [Testing / test cards](https://docs.stripe.com/testing?testing-method=tokens)
- [Dashboard basics](https://docs.stripe.com/dashboard/basics)
- [Teams and access](https://docs.stripe.com/dashboard/teams)
- [Manage access / require 2FA](https://docs.stripe.com/get-started/account/orgs/team)
- [Branding settings](https://docs.stripe.com/get-started/account/branding)

This document is an operational setup guide, not legal advice.
