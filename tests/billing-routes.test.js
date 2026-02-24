import test from "node:test";
import assert from "node:assert/strict";

import { ApiError } from "../src/server/api-error.js";
import { createBillingVerificationSessionPostHandler } from "../app/api/billing/verification-session/route.js";
import { createBillingCheckoutSessionPostHandler } from "../app/api/billing/checkout-session/route.js";
import { createBillingPortalSessionPostHandler } from "../app/api/billing/portal-session/route.js";
import { createBillingSubscriptionGetHandler } from "../app/api/billing/subscription/route.js";
import { createBillingWebhookPostHandler } from "../app/api/billing/webhook/route.js";
import { assertApiErrorResponse } from "./helpers/route-test-helpers.js";

test("createBillingCheckoutSessionPostHandler returns checkout session url for authenticated parent", async () => {
  let recordedParent = null;
  const handler = createBillingCheckoutSessionPostHandler({
    requireParentContext: async () => ({
      parent: { id: "parent_1", email: "parent@example.test", full_name: "Parent" }
    }),
    createStripeCheckoutSessionForParent: async (parent) => {
      recordedParent = parent;
      return { id: "cs_test_123", url: "https://checkout.stripe.test/session", trial_days: 7 };
    }
  });

  const response = await handler(new Request("https://example.test/api/billing/checkout-session", { method: "POST" }));
  assert.equal(response.status, 200);
  assert.equal(recordedParent.id, "parent_1");
  const payload = await response.json();
  assert.equal(payload.checkout.url, "https://checkout.stripe.test/session");
});

test("createBillingVerificationSessionPostHandler returns verification session url for authenticated parent", async () => {
  let recordedParent = null;
  const handler = createBillingVerificationSessionPostHandler({
    requireParentContext: async () => ({
      parent: { id: "parent_1", email: "parent@example.test", full_name: "Parent" }
    }),
    createStripeParentVerificationSessionForParent: async (parent) => {
      recordedParent = parent;
      return { id: "cs_test_verify_123", url: "https://checkout.stripe.test/verify", verification_amount_cents: 100 };
    }
  });

  const response = await handler(
    new Request("https://example.test/api/billing/verification-session", { method: "POST" })
  );
  assert.equal(response.status, 200);
  assert.equal(recordedParent.id, "parent_1");
  const payload = await response.json();
  assert.equal(payload.verification.url, "https://checkout.stripe.test/verify");
});

test("createBillingPortalSessionPostHandler returns portal url", async () => {
  const handler = createBillingPortalSessionPostHandler({
    requireParentContext: async () => ({ parent: { id: "parent_1" } }),
    createStripeBillingPortalSessionForParent: async (parentId) => {
      assert.equal(parentId, "parent_1");
      return { url: "https://billing.stripe.test/portal" };
    }
  });

  const response = await handler(new Request("https://example.test/api/billing/portal-session", { method: "POST" }));
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.portal.url, "https://billing.stripe.test/portal");
});

test("createBillingSubscriptionGetHandler returns normalized billing wrapper", async () => {
  const handler = createBillingSubscriptionGetHandler({
    requireParentContext: async () => ({ parent: { id: "parent_1" } }),
    getParentBillingSubscription: async (parentId) => {
      assert.equal(parentId, "parent_1");
      return { enabled: true, provider: "stripe", subscription: null };
    }
  });

  const response = await handler(new Request("https://example.test/api/billing/subscription", { method: "GET" }));
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.billing.enabled, true);
});

test("createBillingWebhookPostHandler rejects invalid Stripe signature", async () => {
  const handler = createBillingWebhookPostHandler({
    verifyStripeWebhookEvent: () => {
      throw new ApiError(400, "invalid_stripe_signature", "Unable to verify Stripe webhook signature.");
    }
  });

  const response = await handler(
    new Request("https://example.test/api/billing/webhook", {
      method: "POST",
      headers: {
        "stripe-signature": "t=1,v1=bad"
      },
      body: "{}"
    })
  );

  await assertApiErrorResponse(response, {
    status: 400,
    error: "invalid_stripe_signature",
    message: "Unable to verify Stripe webhook signature."
  });
});

test("createBillingWebhookPostHandler processes verified Stripe event", async () => {
  let processedEventId = null;
  const handler = createBillingWebhookPostHandler({
    verifyStripeWebhookEvent: (payload, signature) => {
      assert.equal(payload, "{}");
      assert.equal(signature, "t=1,v1=ok");
      return {
        id: "evt_123",
        type: "checkout.session.completed",
        data: { object: { id: "cs_123" } }
      };
    },
    processStripeWebhookEvent: async (event) => {
      processedEventId = event.id;
      return { processed: true, event_type: event.type };
    }
  });

  const response = await handler(
    new Request("https://example.test/api/billing/webhook", {
      method: "POST",
      headers: {
        "stripe-signature": "t=1,v1=ok"
      },
      body: "{}"
    })
  );

  assert.equal(response.status, 200);
  assert.equal(processedEventId, "evt_123");
  const payload = await response.json();
  assert.equal(payload.ok, true);
});
