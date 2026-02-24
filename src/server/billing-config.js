function parseBooleanEnv(rawValue, fallbackValue) {
  if (rawValue === undefined || rawValue === null || String(rawValue).trim() === "") {
    return fallbackValue;
  }

  const normalized = String(rawValue).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallbackValue;
}

function parseIntegerEnv(rawValue, fallbackValue) {
  if (rawValue === undefined || rawValue === null || String(rawValue).trim() === "") {
    return fallbackValue;
  }

  const parsed = Number.parseInt(String(rawValue).trim(), 10);
  if (!Number.isFinite(parsed)) {
    return fallbackValue;
  }

  return parsed;
}

let cachedConfig;

export function isBillingEnabled(env = process.env) {
  return parseBooleanEnv(env.BILLING_ENABLED, false);
}

export function getStripeBillingConfig(env = process.env) {
  if (env === process.env && cachedConfig) {
    return cachedConfig;
  }

  const enabled = isBillingEnabled(env);
  const provider = String(env.BILLING_PROVIDER || "stripe").trim().toLowerCase() || "stripe";

  const config = {
    enabled,
    provider,
    stripe: {
      secretKey: String(env.STRIPE_SECRET_KEY || "").trim(),
      webhookSecret: String(env.STRIPE_WEBHOOK_SECRET || "").trim(),
      priceIdFamilyMonthly: String(env.STRIPE_PRICE_ID_FAMILY_MONTHLY || "").trim(),
      introCouponIdFirstMonth: String(env.STRIPE_COUPON_ID_FIRST_MONTH_INTRO || "").trim() || null,
      billingPortalConfigId: String(env.STRIPE_BILLING_PORTAL_CONFIG_ID || "").trim() || null,
      parentVerificationAmountCents: parseIntegerEnv(env.STRIPE_PARENT_VERIFICATION_AMOUNT_CENTS, 100),
      parentVerificationCurrency:
        String(env.STRIPE_PARENT_VERIFICATION_CURRENCY || "usd").trim().toLowerCase() || "usd"
    },
    appUrl: String(env.NEXT_PUBLIC_APP_URL || env.APP_URL || "").trim() || null
  };

  if (enabled) {
    if (provider !== "stripe") {
      throw new Error(`Unsupported BILLING_PROVIDER: ${provider}`);
    }

    const missing = [];
    if (!config.stripe.secretKey) {
      missing.push("STRIPE_SECRET_KEY");
    }
    if (!config.stripe.priceIdFamilyMonthly) {
      missing.push("STRIPE_PRICE_ID_FAMILY_MONTHLY");
    }
    if (missing.length > 0) {
      throw new Error(`Missing required billing environment variables: ${missing.join(", ")}`);
    }

    // Legacy two-step verification flow support. The simplified subscription signup flow may not use this.
    if (
      !Number.isInteger(config.stripe.parentVerificationAmountCents) ||
      config.stripe.parentVerificationAmountCents <= 0
    ) {
      throw new Error(
        "Invalid STRIPE_PARENT_VERIFICATION_AMOUNT_CENTS: must be a positive integer amount in cents."
      );
    }

    if (!/^[a-z]{3}$/.test(config.stripe.parentVerificationCurrency)) {
      throw new Error(
        "Invalid STRIPE_PARENT_VERIFICATION_CURRENCY: must be a 3-letter ISO currency code."
      );
    }

    if (config.stripe.introCouponIdFirstMonth && !/^coupon_/.test(config.stripe.introCouponIdFirstMonth)) {
      throw new Error("Invalid STRIPE_COUPON_ID_FIRST_MONTH_INTRO: expected a Stripe coupon id (coupon_...).");
    }

    const nodeEnv = String(env.NODE_ENV ?? "").trim().toLowerCase();
    if (nodeEnv === "production") {
      const productionMissing = [];
      if (!config.stripe.webhookSecret) {
        productionMissing.push("STRIPE_WEBHOOK_SECRET");
      }
      if (!config.appUrl) {
        productionMissing.push("NEXT_PUBLIC_APP_URL");
      }
      if (productionMissing.length > 0) {
        throw new Error(
          `Missing required production billing environment variables: ${productionMissing.join(", ")}`
        );
      }
    }
  }

  if (env === process.env) {
    cachedConfig = config;
  }

  return config;
}

export function resetBillingConfigCache() {
  cachedConfig = undefined;
}
