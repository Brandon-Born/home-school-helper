import { ApiError } from "../../../../src/server/api-error.js";
import { requireParentContext } from "../../../../src/server/auth.js";
import { getStripeBillingConfig, isBillingEnabled } from "../../../../src/server/billing-config.js";
import { handleRouteError } from "../../../../src/server/route-errors.js";
import { getServiceSupabaseClient } from "../../../../src/server/supabase-clients.js";
import { setParentCoppaConsentState, COPPA_CONSENT_STATUS } from "../../../../src/server/session-foundation-service.js";
import { isTestAuthBootstrapEnabled } from "../bootstrap/route.js";

function requireMatchingTestSecret(request, env = process.env) {
  if (!isTestAuthBootstrapEnabled(env)) {
    throw new ApiError(404, "not_found", "Not found.");
  }

  const expectedSecret = String(env.PLAYWRIGHT_TEST_AUTH_SECRET ?? "").trim();
  if (!expectedSecret) {
    throw new ApiError(
      500,
      "test_auth_misconfigured",
      "PLAYWRIGHT_TEST_AUTH_SECRET is required when test auth bootstrap is enabled."
    );
  }

  const providedSecret = String(request.headers.get("x-test-auth-secret") ?? "").trim();
  if (!providedSecret || providedSecret !== expectedSecret) {
    throw new ApiError(401, "invalid_test_auth_secret", "Invalid test auth secret.");
  }
}

function buildTrialingSubscriptionSeed(parentId, config) {
  const now = Date.now();
  const trialStart = new Date(now).toISOString();
  const trialEnd = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
  const periodEnd = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
  const compactId = String(parentId || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 18) || "parent";

  return {
    parent_id: parentId,
    provider: "stripe",
    provider_customer_id: `cus_test_${compactId}`,
    provider_subscription_id: `sub_test_${compactId}`,
    provider_price_id: config.stripe.priceIdFamilyMonthly,
    status: "trialing",
    trial_start_at: trialStart,
    trial_end_at: trialEnd,
    current_period_start_at: trialStart,
    current_period_end_at: periodEnd,
    cancel_at_period_end: false,
    canceled_at: null,
    parent_verification_completed_at: trialStart,
    parent_verification_payment_intent_id: `pi_test_${compactId}`,
    parent_verification_amount_cents: config.stripe.parentVerificationAmountCents,
    parent_verification_currency: config.stripe.parentVerificationCurrency,
    updated_at: trialStart
  };
}

export function createTestAuthSeedParentBillingPostHandler(dependencies = {}) {
  const env = dependencies.env ?? process.env;
  const requireParent = dependencies.requireParentContext ?? requireParentContext;
  const getServiceClient = dependencies.getServiceSupabaseClient ?? getServiceSupabaseClient;
  const writeConsent = dependencies.setParentCoppaConsentState ?? setParentCoppaConsentState;
  const onError = dependencies.handleRouteError ?? handleRouteError;

  return async function POST(request) {
    try {
      requireMatchingTestSecret(request, env);

      const { parent } = await requireParent(request);
      const serviceClient = await getServiceClient();
      const billingEnabled = isBillingEnabled(env);
      let subscription = null;

      if (billingEnabled) {
        const config = getStripeBillingConfig(env);
        const seedRow = buildTrialingSubscriptionSeed(parent.id, config);
        const { data, error } = await serviceClient
          .from("billing_subscriptions")
          .upsert(seedRow, { onConflict: "parent_id,provider" })
          .select(
            "provider, status, provider_customer_id, provider_subscription_id, provider_price_id, trial_start_at, trial_end_at, current_period_start_at, current_period_end_at, cancel_at_period_end, canceled_at, parent_verification_completed_at, parent_verification_payment_intent_id, parent_verification_amount_cents, parent_verification_currency, updated_at"
          )
          .single();

        if (error || !data) {
          throw new ApiError(500, "test_auth_seed_billing_failed", "Unable to seed billing subscription state.");
        }

        subscription = data;
      }

      const consent = await writeConsent(
        parent.id,
        {
          status: COPPA_CONSENT_STATUS.granted,
          method: billingEnabled ? "stripe_card_verification_charge" : "parent_self_attestation",
          actorParentId: parent.id
        },
        { serviceClient, env, request }
      );

      return Response.json({
        seeded: {
          billing_enabled: billingEnabled,
          consent,
          subscription
        }
      });
    } catch (error) {
      return onError(error, "test_auth_seed_parent_billing_failed");
    }
  };
}

export const POST = createTestAuthSeedParentBillingPostHandler();
