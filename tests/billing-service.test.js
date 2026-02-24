import test from "node:test";
import assert from "node:assert/strict";

import { ApiError } from "../src/server/api-error.js";
import { ensureParentHasBillingAccess, processStripeWebhookEvent } from "../src/server/billing-service.js";
import { createFakeServiceClient } from "./helpers/fake-service-client.js";

function buildBillingConfig({ grantCoppaOnTrialSignup = true } = {}) {
  return {
    enabled: true,
    provider: "stripe",
    stripe: {
      secretKey: "sk_test_123",
      webhookSecret: "whsec_123",
      priceIdFamilyMonthly: "price_test_123",
      billingPortalConfigId: null
    },
    appUrl: "https://example.test",
    allowSelfAttestationConsentGrant: false,
    grantCoppaOnTrialSignup
  };
}

function buildEnv() {
  return {
    NODE_ENV: "test",
    COPPA_POLICY_VERSION: "2026-02-19",
    COPPA_POLICY_URL: "/privacy"
  };
}

function buildParent({ consentStatus = "pending" } = {}) {
  return {
    id: "parent_1",
    auth_user_id: "auth_parent_1",
    email: "parent@example.test",
    full_name: "Parent",
    onboarding_completed: false,
    coppa_consent_status: consentStatus,
    coppa_consent_updated_at: consentStatus === "granted" ? "2026-02-19T00:00:00.000Z" : null,
    coppa_policy_version: "2026-02-19",
    coppa_consent_method: consentStatus === "granted" ? "parent_self_attestation" : null,
    created_at: "2026-02-19T00:00:00.000Z"
  };
}

function buildSubscriptionEvent({
  id = "evt_1",
  type = "customer.subscription.updated",
  created = 1_770_000_000,
  status = "trialing",
  subscriptionId = "sub_1",
  customerId = "cus_1",
  parentId = "parent_1"
} = {}) {
  return {
    id,
    type,
    created,
    data: {
      object: {
        id: subscriptionId,
        object: "subscription",
        customer: customerId,
        status,
        trial_start: created,
        trial_end: created + 7 * 24 * 60 * 60,
        current_period_start: created,
        current_period_end: created + 30 * 24 * 60 * 60,
        cancel_at_period_end: false,
        canceled_at: null,
        metadata: {
          parent_id: parentId
        },
        items: {
          data: [
            {
              price: {
                id: "price_test_123"
              }
            }
          ]
        }
      }
    }
  };
}

test("processStripeWebhookEvent grants COPPA consent from trialing subscription when enabled", async () => {
  const serviceClient = createFakeServiceClient({
    parents: [buildParent()],
    billing_subscriptions: [],
    billing_webhook_events: [],
    parent_consents: []
  });

  const result = await processStripeWebhookEvent(buildSubscriptionEvent(), {
    serviceClient,
    config: buildBillingConfig({ grantCoppaOnTrialSignup: true }),
    env: buildEnv()
  });

  assert.equal(result.processed, true);
  assert.equal(result.outcome.skipped, false);
  assert.equal(serviceClient.tables.billing_subscriptions.length, 1);
  assert.equal(serviceClient.tables.billing_subscriptions[0].status, "trialing");
  assert.equal(serviceClient.tables.parents[0].coppa_consent_status, "granted");
  assert.equal(serviceClient.tables.parent_consents.length, 1);
  assert.equal(serviceClient.tables.parent_consents[0].method, "stripe_subscription_trial_signup");
});

test("processStripeWebhookEvent does not grant trial-based consent when trial grant policy is disabled", async () => {
  const serviceClient = createFakeServiceClient({
    parents: [buildParent()],
    billing_subscriptions: [],
    billing_webhook_events: [],
    parent_consents: []
  });

  await processStripeWebhookEvent(buildSubscriptionEvent({ id: "evt_trial_no_grant" }), {
    serviceClient,
    config: buildBillingConfig({ grantCoppaOnTrialSignup: false }),
    env: buildEnv()
  });

  assert.equal(serviceClient.tables.parents[0].coppa_consent_status, "pending");
  assert.equal(serviceClient.tables.parent_consents.length, 0);
});

test("processStripeWebhookEvent grants COPPA consent from active subscription even when trial grant policy is disabled", async () => {
  const serviceClient = createFakeServiceClient({
    parents: [buildParent()],
    billing_subscriptions: [],
    billing_webhook_events: [],
    parent_consents: []
  });

  await processStripeWebhookEvent(buildSubscriptionEvent({ id: "evt_active", status: "active" }), {
    serviceClient,
    config: buildBillingConfig({ grantCoppaOnTrialSignup: false }),
    env: buildEnv()
  });

  assert.equal(serviceClient.tables.parents[0].coppa_consent_status, "granted");
  assert.equal(serviceClient.tables.parent_consents[0].method, "stripe_subscription_active_charge");
});

test("processStripeWebhookEvent skips stale subscription event updates but still marks event processed", async () => {
  const serviceClient = createFakeServiceClient({
    parents: [buildParent({ consentStatus: "granted" })],
    billing_subscriptions: [
      {
        id: "billing_1",
        parent_id: "parent_1",
        provider: "stripe",
        provider_customer_id: "cus_1",
        provider_subscription_id: "sub_1",
        provider_price_id: "price_test_123",
        status: "active",
        cancel_at_period_end: false,
        last_webhook_event_created_at: "2026-02-24T12:00:00.000Z"
      }
    ],
    billing_webhook_events: [],
    parent_consents: []
  });

  const staleEvent = buildSubscriptionEvent({
    id: "evt_stale",
    created: Math.floor(new Date("2026-02-24T11:00:00.000Z").getTime() / 1000),
    status: "past_due"
  });

  const result = await processStripeWebhookEvent(staleEvent, {
    serviceClient,
    config: buildBillingConfig(),
    env: buildEnv()
  });

  assert.equal(result.processed, true);
  assert.equal(result.outcome.skipped, true);
  assert.equal(result.outcome.reason, "stale_event");
  assert.equal(serviceClient.tables.billing_subscriptions[0].status, "active");
  const logged = serviceClient.tables.billing_webhook_events.find((row) => row.provider_event_id === "evt_stale");
  assert.ok(logged?.processed_at);
});

test("processStripeWebhookEvent re-processes duplicate event that was stored but not marked processed", async () => {
  const serviceClient = createFakeServiceClient({
    parents: [buildParent()],
    billing_subscriptions: [],
    billing_webhook_events: [
      {
        id: "bhe_1",
        provider: "stripe",
        provider_event_id: "evt_retry",
        event_type: "customer.subscription.updated",
        processed_at: null,
        payload: {}
      }
    ],
    parent_consents: []
  });

  const result = await processStripeWebhookEvent(buildSubscriptionEvent({ id: "evt_retry", status: "trialing" }), {
    serviceClient,
    config: buildBillingConfig(),
    env: buildEnv()
  });

  assert.equal(result.duplicate, true);
  assert.equal(result.processed, true);
  assert.equal(result.outcome.skipped, false);
  assert.equal(serviceClient.tables.billing_subscriptions.length, 1);
  const logged = serviceClient.tables.billing_webhook_events.find((row) => row.provider_event_id === "evt_retry");
  assert.ok(logged?.processed_at);
});

test("processStripeWebhookEvent returns ignored outcome for unsupported event types", async () => {
  const serviceClient = createFakeServiceClient({
    billing_webhook_events: []
  });

  const result = await processStripeWebhookEvent(
    {
      id: "evt_ignored",
      type: "invoice.upcoming",
      created: 1_770_000_000,
      data: { object: { id: "in_1" } }
    },
    {
      serviceClient,
      config: buildBillingConfig(),
      env: buildEnv()
    }
  );

  assert.equal(result.processed, true);
  assert.equal(result.outcome.skipped, true);
  assert.equal(result.outcome.reason, "ignored_event_type");
});

test("ensureParentHasBillingAccess allows trialing and blocks canceled/past_due when billing enabled", async () => {
  const serviceClient = createFakeServiceClient({
    parents: [buildParent({ consentStatus: "granted" })],
    billing_subscriptions: [
      {
        id: "billing_1",
        parent_id: "parent_1",
        provider: "stripe",
        provider_customer_id: "cus_1",
        provider_subscription_id: "sub_1",
        provider_price_id: "price_test_123",
        status: "trialing",
        cancel_at_period_end: false
      }
    ]
  });

  const allowed = await ensureParentHasBillingAccess("parent_1", {
    serviceClient,
    config: buildBillingConfig(),
    env: buildEnv()
  });
  assert.equal(allowed.has_access, true);
  assert.equal(allowed.status, "trialing");

  serviceClient.tables.billing_subscriptions[0].status = "canceled";

  await assert.rejects(
    () =>
      ensureParentHasBillingAccess("parent_1", {
        serviceClient,
        config: buildBillingConfig(),
        env: buildEnv()
      }),
    (error) =>
      error instanceof ApiError && error.status === 402 && error.code === "billing_subscription_required"
  );
});
