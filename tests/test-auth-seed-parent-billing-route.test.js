import test from "node:test";
import assert from "node:assert/strict";

import { createTestAuthSeedParentBillingPostHandler } from "../app/api/test-auth/seed-parent-billing/route.js";
import { createFakeServiceClient } from "./helpers/fake-service-client.js";
import { assertApiErrorResponse } from "./helpers/route-test-helpers.js";

function createSeedRequest(headers = {}) {
  return new Request("http://localhost:3000/api/test-auth/seed-parent-billing", {
    method: "POST",
    headers
  });
}

test("test auth seed parent billing route returns not_found when test auth bootstrap is disabled", async () => {
  const handler = createTestAuthSeedParentBillingPostHandler({
    env: {
      NODE_ENV: "development",
      ENABLE_TEST_AUTH_BOOTSTRAP: "0"
    }
  });

  const response = await handler(createSeedRequest());
  await assertApiErrorResponse(response, {
    status: 404,
    error: "not_found",
    message: "Not found."
  });
});

test("test auth seed parent billing route requires matching secret header", async () => {
  const handler = createTestAuthSeedParentBillingPostHandler({
    env: {
      NODE_ENV: "development",
      ENABLE_TEST_AUTH_BOOTSTRAP: "1",
      PLAYWRIGHT_TEST_AUTH_SECRET: "top-secret"
    }
  });

  const response = await handler(createSeedRequest());
  await assertApiErrorResponse(response, {
    status: 401,
    error: "invalid_test_auth_secret",
    message: "Invalid test auth secret."
  });
});

test("test auth seed parent billing route seeds trialing billing + stripe verification consent when billing enabled", async () => {
  const serviceClient = createFakeServiceClient({
    billing_subscriptions: [],
    parents: [
      {
        id: "parent_1",
        auth_user_id: "auth_parent_1",
        email: "playwright-parent@example.test",
        full_name: "Playwright Parent",
        onboarding_completed: false,
        coppa_consent_status: "pending",
        coppa_consent_updated_at: null,
        coppa_policy_version: "2026-02-19",
        coppa_consent_method: null,
        created_at: "2026-02-19T00:00:00.000Z"
      }
    ],
    parent_consents: []
  });

  const handler = createTestAuthSeedParentBillingPostHandler({
    env: {
      NODE_ENV: "development",
      ENABLE_TEST_AUTH_BOOTSTRAP: "1",
      PLAYWRIGHT_TEST_AUTH_SECRET: "top-secret",
      BILLING_ENABLED: "1",
      STRIPE_SECRET_KEY: "sk_test_123",
      STRIPE_PRICE_ID_FAMILY_MONTHLY: "price_test_123",
      STRIPE_WEBHOOK_SECRET: "whsec_123"
    },
    requireParentContext: async () => ({
      parent: { id: "parent_1" }
    }),
    getServiceSupabaseClient: () => serviceClient
  });

  const response = await handler(
    createSeedRequest({
      "x-test-auth-secret": "top-secret"
    })
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.seeded.billing_enabled, true);
  assert.equal(body.seeded.subscription.status, "trialing");
  assert.equal(body.seeded.consent.status, "granted");
  assert.equal(body.seeded.consent.method, "stripe_card_verification_charge");
  assert.equal(serviceClient.tables.billing_subscriptions.length, 1);
  assert.equal(serviceClient.tables.parent_consents.length, 1);
  assert.equal(serviceClient.tables.parent_consents[0].method, "stripe_card_verification_charge");
});
