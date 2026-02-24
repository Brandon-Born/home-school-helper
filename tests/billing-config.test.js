import test from "node:test";
import assert from "node:assert/strict";

import {
  getStripeBillingConfig,
  isBillingEnabled,
  isSelfAttestationConsentGrantAllowed,
  resetBillingConfigCache
} from "../src/server/billing-config.js";

test("billing config defaults to disabled and self-attestation allowed", () => {
  resetBillingConfigCache();
  const env = { NODE_ENV: "test" };

  assert.equal(isBillingEnabled(env), false);
  assert.equal(isSelfAttestationConsentGrantAllowed(env), true);

  const config = getStripeBillingConfig(env);
  assert.equal(config.enabled, false);
  assert.equal(config.provider, "stripe");
});

test("billing config requires Stripe secret key and price id when enabled", () => {
  resetBillingConfigCache();

  assert.throws(
    () =>
      getStripeBillingConfig({
        BILLING_ENABLED: "true",
        BILLING_PROVIDER: "stripe",
        STRIPE_SECRET_KEY: "",
        STRIPE_PRICE_ID_FAMILY_MONTHLY: ""
      }),
    /Missing required billing environment variables/
  );
});

test("billing config disables self-attestation grant by default when billing enabled", () => {
  resetBillingConfigCache();
  const env = {
    BILLING_ENABLED: "true",
    STRIPE_SECRET_KEY: "sk_test_123",
    STRIPE_PRICE_ID_FAMILY_MONTHLY: "price_test_123"
  };

  const config = getStripeBillingConfig(env);
  assert.equal(config.enabled, true);
  assert.equal(config.allowSelfAttestationConsentGrant, false);
});

test("billing config requires webhook secret and app url in production when billing enabled", () => {
  resetBillingConfigCache();

  assert.throws(
    () =>
      getStripeBillingConfig({
        NODE_ENV: "production",
        BILLING_ENABLED: "true",
        STRIPE_SECRET_KEY: "sk_live_123",
        STRIPE_PRICE_ID_FAMILY_MONTHLY: "price_live_123"
      }),
    /Missing required production billing environment variables/
  );
});
