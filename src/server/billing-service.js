import { ApiError } from "./api-error.js";
import { getStripeBillingConfig } from "./billing-config.js";
import { getServiceSupabaseClient } from "./supabase-clients.js";
import { getStripeClient } from "./stripe-client.js";
import {
  COPPA_CONSENT_STATUS,
  getParentCoppaConsentState,
  setParentCoppaConsentState
} from "./session-foundation/coppa-consent-service.js";

const BILLING_PROVIDER = "stripe";
const STRIPE_VERIFICATION_FLOW = "coppa_parent_payment_verification";
const STRIPE_VERIFICATION_CONSENT_METHOD = "stripe_card_verification_charge";
const STRIPE_SUBSCRIPTION_CHECKOUT_CONSENT_METHOD = "stripe_subscription_checkout_payment";
const BILLING_ACCESS_STATUSES = new Set(["trialing", "active"]);
const BILLING_RECONCILE_SCOPES = new Set(["problem", "full"]);
const BILLING_RECONCILE_PROBLEM_STATUSES = [
  "incomplete",
  "incomplete_expired",
  "past_due",
  "unpaid",
  "paused",
  "canceled"
];
const SYNCABLE_STRIPE_EVENT_TYPES = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted"
]);

function isoOrNull(unixSeconds) {
  if (typeof unixSeconds !== "number" || !Number.isFinite(unixSeconds) || unixSeconds <= 0) {
    return null;
  }
  return new Date(unixSeconds * 1000).toISOString();
}

function normalizeStatus(rawStatus) {
  const value = String(rawStatus || "").trim().toLowerCase();
  return value || "incomplete";
}

function parsePositiveInteger(value, fallbackValue) {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallbackValue;
  }
  return parsed;
}

function eventCreatedAtIso(event) {
  return isoOrNull(event?.created);
}

function isIncomingEventStale(existingRow, incomingEventCreatedAtIso) {
  const previous = existingRow?.last_webhook_event_created_at ?? null;
  if (!previous || !incomingEventCreatedAtIso) {
    return false;
  }

  const previousMs = Date.parse(previous);
  const incomingMs = Date.parse(incomingEventCreatedAtIso);
  if (Number.isNaN(previousMs) || Number.isNaN(incomingMs)) {
    return false;
  }

  return incomingMs < previousMs;
}

function normalizeBillingRow(row) {
  if (!row) {
    return null;
  }

  const status = normalizeStatus(row.status);
  return {
    provider: row.provider,
    status,
    has_access: BILLING_ACCESS_STATUSES.has(status),
    provider_customer_id: row.provider_customer_id ?? null,
    provider_subscription_id: row.provider_subscription_id ?? null,
    provider_price_id: row.provider_price_id ?? null,
    trial_start_at: row.trial_start_at ?? null,
    trial_end_at: row.trial_end_at ?? null,
    current_period_start_at: row.current_period_start_at ?? null,
    current_period_end_at: row.current_period_end_at ?? null,
    cancel_at_period_end: Boolean(row.cancel_at_period_end),
    canceled_at: row.canceled_at ?? null,
    parent_verification_completed_at: row.parent_verification_completed_at ?? null,
    parent_verification_payment_intent_id: row.parent_verification_payment_intent_id ?? null,
    parent_verification_amount_cents: row.parent_verification_amount_cents ?? null,
    parent_verification_currency: row.parent_verification_currency ?? null,
    last_webhook_event_created_at: row.last_webhook_event_created_at ?? null,
    updated_at: row.updated_at ?? null
  };
}

function resolveBaseUrl(request, config) {
  if (config.appUrl) {
    return config.appUrl.replace(/\/$/, "");
  }

  try {
    return new URL(request.url).origin;
  } catch {
    throw new ApiError(500, "billing_app_url_missing", "Billing app URL is not configured.");
  }
}

async function findBillingRowByParent(parentId, { serviceClient }) {
  const { data, error } = await serviceClient
    .from("billing_subscriptions")
    .select(
      "id, parent_id, provider, provider_customer_id, provider_subscription_id, provider_price_id, status, trial_start_at, trial_end_at, current_period_start_at, current_period_end_at, cancel_at_period_end, canceled_at, parent_verification_completed_at, parent_verification_payment_intent_id, parent_verification_amount_cents, parent_verification_currency, last_webhook_event_created_at, updated_at"
    )
    .eq("parent_id", parentId)
    .eq("provider", BILLING_PROVIDER)
    .maybeSingle();

  if (error) {
    throw new ApiError(500, "billing_lookup_failed", "Unable to fetch billing subscription state.");
  }

  return data ?? null;
}

async function findBillingRowByStripeIds({ providerSubscriptionId, providerCustomerId, serviceClient }) {
  let query = serviceClient
    .from("billing_subscriptions")
    .select("id, parent_id, provider_customer_id, provider_subscription_id, status, last_webhook_event_created_at")
    .eq("provider", BILLING_PROVIDER);

  if (providerSubscriptionId) {
    query = query.eq("provider_subscription_id", providerSubscriptionId);
  } else if (providerCustomerId) {
    query = query.eq("provider_customer_id", providerCustomerId);
  } else {
    return null;
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new ApiError(500, "billing_lookup_failed", "Unable to fetch billing subscription state.");
  }

  return data ?? null;
}

async function listBillingRowsForReconciliation({ serviceClient, scope = "problem", limit = 250 }) {
  let query = serviceClient
    .from("billing_subscriptions")
    .select(
      "id, parent_id, provider, provider_customer_id, provider_subscription_id, provider_price_id, status, trial_start_at, trial_end_at, current_period_start_at, current_period_end_at, cancel_at_period_end, canceled_at, parent_verification_completed_at, parent_verification_payment_intent_id, parent_verification_amount_cents, parent_verification_currency, last_webhook_event_created_at, updated_at"
    )
    .eq("provider", BILLING_PROVIDER)
    .order("updated_at", { ascending: true });

  if (scope === "problem") {
    query = query.in("status", BILLING_RECONCILE_PROBLEM_STATUSES);
  }

  if (Number.isInteger(limit) && limit > 0) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) {
    throw new ApiError(500, "billing_lookup_failed", "Unable to fetch billing subscriptions for reconciliation.");
  }

  return Array.isArray(data) ? data : [];
}

async function upsertBillingSubscription(row, { serviceClient }) {
  const payload = {
    provider: BILLING_PROVIDER,
    ...row,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await serviceClient
    .from("billing_subscriptions")
    .upsert(payload, { onConflict: "parent_id,provider" })
    .select(
      "id, parent_id, provider, provider_customer_id, provider_subscription_id, provider_price_id, status, trial_start_at, trial_end_at, current_period_start_at, current_period_end_at, cancel_at_period_end, canceled_at, parent_verification_completed_at, parent_verification_payment_intent_id, parent_verification_amount_cents, parent_verification_currency, last_webhook_event_created_at, updated_at"
    )
    .single();

  if (error || !data) {
    throw new ApiError(500, "billing_update_failed", "Unable to update billing subscription state.");
  }

  return data;
}

function isStripeResourceMissingError(error) {
  if (!error) {
    return false;
  }

  if (String(error?.code || "").trim().toLowerCase() === "resource_missing") {
    return true;
  }

  const status = Number(error?.statusCode ?? error?.status ?? 0);
  if (Number.isFinite(status) && status === 404) {
    return true;
  }

  return false;
}

function buildCanceledRowFromMissingStripeResource(localRow, nowIso, config) {
  return {
    parent_id: localRow.parent_id,
    provider_customer_id: localRow.provider_customer_id ?? null,
    provider_subscription_id: localRow.provider_subscription_id ?? null,
    provider_price_id: localRow.provider_price_id ?? config.stripe.priceIdFamilyMonthly,
    status: "canceled",
    trial_start_at: localRow.trial_start_at ?? null,
    trial_end_at: localRow.trial_end_at ?? null,
    current_period_start_at: localRow.current_period_start_at ?? null,
    current_period_end_at: localRow.current_period_end_at ?? null,
    cancel_at_period_end: false,
    canceled_at: localRow.canceled_at ?? nowIso,
    parent_verification_completed_at: localRow.parent_verification_completed_at ?? null,
    parent_verification_payment_intent_id: localRow.parent_verification_payment_intent_id ?? null,
    parent_verification_amount_cents: localRow.parent_verification_amount_cents ?? null,
    parent_verification_currency: localRow.parent_verification_currency ?? null
  };
}

async function ensureStripeCustomerForParent(parent, options = {}) {
  const serviceClient = options.serviceClient ?? getServiceSupabaseClient();
  const stripeClient = options.stripeClient ?? getStripeClient(options.env);
  const config = options.config ?? getStripeBillingConfig(options.env ?? process.env);

  const existing = await findBillingRowByParent(parent.id, { serviceClient });
  if (existing?.provider_customer_id) {
    return {
      providerCustomerId: existing.provider_customer_id,
      billingRow: existing,
      created: false
    };
  }

  const customer = await stripeClient.customers.create({
    email: parent.email ?? undefined,
    name: parent.full_name ?? undefined,
    metadata: {
      parent_id: parent.id
    }
  });

  const billingRow = await upsertBillingSubscription(
    {
      parent_id: parent.id,
      provider_customer_id: customer.id,
      provider_subscription_id: existing?.provider_subscription_id ?? null,
      provider_price_id: config.stripe.priceIdFamilyMonthly,
      status: existing?.status ?? "incomplete"
    },
    { serviceClient }
  );

  return {
    providerCustomerId: customer.id,
    billingRow,
    created: true
  };
}

function mapStripeSubscriptionToBillingRow(parentId, subscription, options = {}) {
  const items = Array.isArray(subscription?.items?.data) ? subscription.items.data : [];
  const firstPrice = items[0]?.price;
  const incomingEventCreatedAt = options.eventCreatedAt ?? null;
  const incomingEventId = options.eventId ?? null;

  return {
    parent_id: parentId,
    provider_customer_id:
      typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? null,
    provider_subscription_id: subscription.id,
    provider_price_id: firstPrice?.id ?? null,
    status: normalizeStatus(subscription.status),
    trial_start_at: isoOrNull(subscription.trial_start),
    trial_end_at: isoOrNull(subscription.trial_end),
    current_period_start_at: isoOrNull(subscription.current_period_start),
    current_period_end_at: isoOrNull(subscription.current_period_end),
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    canceled_at: isoOrNull(subscription.canceled_at),
    last_webhook_event_id: incomingEventId,
    last_webhook_event_created_at: incomingEventCreatedAt
  };
}

async function resolveParentIdForStripeSubscription(subscription, { serviceClient }) {
  const metadataParentId = String(subscription?.metadata?.parent_id || "").trim();
  if (metadataParentId) {
    return metadataParentId;
  }

  const customerId = typeof subscription?.customer === "string" ? subscription.customer : null;
  const existing = await findBillingRowByStripeIds(
    {
      providerSubscriptionId: subscription?.id ?? null,
      providerCustomerId: customerId,
      serviceClient
    }
  );

  return existing?.parent_id ?? null;
}

async function maybeGrantCoppaConsentFromVerification(parentId, options = {}) {
  const env = options.env ?? process.env;
  const serviceClient = options.serviceClient ?? getServiceSupabaseClient();

  const currentConsent = await getParentCoppaConsentState(parentId, { serviceClient, env });
  if (currentConsent.status === COPPA_CONSENT_STATUS.granted) {
    return currentConsent;
  }

  return setParentCoppaConsentState(
    parentId,
    {
      status: COPPA_CONSENT_STATUS.granted,
      method: STRIPE_VERIFICATION_CONSENT_METHOD,
      actorParentId: parentId
    },
    { serviceClient, env }
  );
}

export async function getParentBillingSubscription(parentId, options = {}) {
  const env = options.env ?? process.env;
  const config = options.config ?? getStripeBillingConfig(env);
  if (!config.enabled) {
    return {
      enabled: false,
      provider: null,
      subscription: null
    };
  }

  const serviceClient = options.serviceClient ?? getServiceSupabaseClient();
  const row = await findBillingRowByParent(parentId, { serviceClient });

  return {
    enabled: true,
    provider: BILLING_PROVIDER,
    subscription: normalizeBillingRow(row)
  };
}

export async function ensureParentHasBillingAccess(parentId, options = {}) {
  const billing = await getParentBillingSubscription(parentId, options);
  if (!billing.enabled) {
    return {
      required: false,
      provider: null,
      status: null,
      has_access: true,
      subscription: null
    };
  }

  const status = normalizeStatus(billing.subscription?.status);
  const hasAccess = Boolean(billing.subscription?.has_access);

  if (!billing.subscription || !hasAccess) {
    throw new ApiError(
      402,
      "billing_subscription_required",
      "An active family subscription is required before starting new sessions."
    );
  }

  return {
    required: true,
    provider: billing.provider,
    status,
    has_access: true,
    subscription: billing.subscription
  };
}

export async function createStripeCheckoutSessionForParent(parent, options = {}) {
  const env = options.env ?? process.env;
  const config = options.config ?? getStripeBillingConfig(env);
  if (!config.enabled) {
    throw new ApiError(409, "billing_not_enabled", "Subscription billing is not enabled.");
  }

  const serviceClient = options.serviceClient ?? getServiceSupabaseClient();
  const stripeClient = options.stripeClient ?? getStripeClient(env);
  const request = options.request;
  const baseUrl = resolveBaseUrl(request, config);

  const { providerCustomerId } = await ensureStripeCustomerForParent(parent, {
    serviceClient,
    stripeClient,
    env,
    config
  });

  const sessionPayload = {
    mode: "subscription",
    customer: providerCustomerId,
    allow_promotion_codes: true,
    line_items: [
      {
        price: config.stripe.priceIdFamilyMonthly,
        quantity: 1
      }
    ],
    success_url: `${baseUrl}/parent?billing=checkout_success`,
    cancel_url: `${baseUrl}/parent?billing=checkout_canceled`,
    metadata: {
      parent_id: parent.id,
      coppa_policy_version: String(parent.coppa_policy_version || "")
    },
    subscription_data: {
      metadata: {
        parent_id: parent.id,
        coppa_policy_version: String(parent.coppa_policy_version || "")
      }
    }
  };

  if (config.stripe.introCouponIdFirstMonth) {
    sessionPayload.discounts = [{ coupon: config.stripe.introCouponIdFirstMonth }];
  }

  const session = await stripeClient.checkout.sessions.create(sessionPayload);

  return {
    id: session.id,
    url: session.url,
    intro_offer: {
      first_month_discount_coupon_applied: Boolean(config.stripe.introCouponIdFirstMonth)
    }
  };
}

export async function createStripeParentVerificationSessionForParent(parent, options = {}) {
  const env = options.env ?? process.env;
  const config = options.config ?? getStripeBillingConfig(env);
  if (!config.enabled) {
    throw new ApiError(409, "billing_not_enabled", "Subscription billing is not enabled.");
  }

  const serviceClient = options.serviceClient ?? getServiceSupabaseClient();
  const stripeClient = options.stripeClient ?? getStripeClient(env);
  const request = options.request;
  const baseUrl = resolveBaseUrl(request, config);

  const { providerCustomerId } = await ensureStripeCustomerForParent(parent, {
    serviceClient,
    stripeClient,
    env,
    config
  });

  const session = await stripeClient.checkout.sessions.create({
    mode: "payment",
    customer: providerCustomerId,
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: config.stripe.parentVerificationCurrency,
          unit_amount: config.stripe.parentVerificationAmountCents,
          product_data: {
            name: "Parent payment method verification"
          }
        },
        quantity: 1
      }
    ],
    success_url: `${baseUrl}/parent?billing=verification_success`,
    cancel_url: `${baseUrl}/parent?billing=verification_canceled`,
    metadata: {
      parent_id: parent.id,
      billing_flow: STRIPE_VERIFICATION_FLOW,
      coppa_policy_version: String(parent.coppa_policy_version || "")
    },
    payment_intent_data: {
      setup_future_usage: "off_session",
      metadata: {
        parent_id: parent.id,
        billing_flow: STRIPE_VERIFICATION_FLOW,
        coppa_policy_version: String(parent.coppa_policy_version || "")
      }
    }
  });

  return {
    id: session.id,
    url: session.url,
    verification_amount_cents: config.stripe.parentVerificationAmountCents,
    verification_currency: config.stripe.parentVerificationCurrency
  };
}

export async function createStripeBillingPortalSessionForParent(parentId, options = {}) {
  const env = options.env ?? process.env;
  const config = options.config ?? getStripeBillingConfig(env);
  if (!config.enabled) {
    throw new ApiError(409, "billing_not_enabled", "Subscription billing is not enabled.");
  }

  const serviceClient = options.serviceClient ?? getServiceSupabaseClient();
  const stripeClient = options.stripeClient ?? getStripeClient(env);
  const request = options.request;
  const baseUrl = resolveBaseUrl(request, config);
  const row = await findBillingRowByParent(parentId, { serviceClient });

  if (!row?.provider_customer_id) {
    throw new ApiError(404, "billing_customer_not_found", "No billing customer exists for this parent yet.");
  }

  const payload = {
    customer: row.provider_customer_id,
    return_url: `${baseUrl}/parent?billing=portal_return`
  };

  if (config.stripe.billingPortalConfigId) {
    payload.configuration = config.stripe.billingPortalConfigId;
  }

  const session = await stripeClient.billingPortal.sessions.create(payload);
  return {
    url: session.url
  };
}

export function verifyStripeWebhookEvent(payload, signature, options = {}) {
  const env = options.env ?? process.env;
  const config = options.config ?? getStripeBillingConfig(env);
  if (!config.enabled) {
    throw new ApiError(404, "billing_not_enabled", "Subscription billing is not enabled.");
  }

  if (!config.stripe.webhookSecret) {
    throw new ApiError(500, "stripe_webhook_secret_missing", "Stripe webhook secret is not configured.");
  }

  if (!String(signature || "").trim()) {
    throw new ApiError(400, "missing_stripe_signature", "Stripe signature header is required.");
  }

  const stripeClient = options.stripeClient ?? getStripeClient(env);

  try {
    return stripeClient.webhooks.constructEvent(payload, signature, config.stripe.webhookSecret);
  } catch {
    throw new ApiError(400, "invalid_stripe_signature", "Unable to verify Stripe webhook signature.");
  }
}

async function recordWebhookEventStart(event, { serviceClient }) {
  const { data: existing, error: lookupError } = await serviceClient
    .from("billing_webhook_events")
    .select("id, processed_at")
    .eq("provider", BILLING_PROVIDER)
    .eq("provider_event_id", event.id)
    .maybeSingle();

  if (lookupError) {
    throw new ApiError(500, "billing_webhook_store_failed", "Unable to read webhook event log.");
  }

  if (existing) {
    return {
      duplicate: true,
      alreadyProcessed: Boolean(existing.processed_at)
    };
  }

  const { error: insertError } = await serviceClient.from("billing_webhook_events").insert({
    provider: BILLING_PROVIDER,
    provider_event_id: event.id,
    event_type: event.type,
    payload: event
  });

  if (insertError) {
    throw new ApiError(500, "billing_webhook_store_failed", "Unable to store webhook event.");
  }

  return {
    duplicate: false,
    alreadyProcessed: false
  };
}

async function markWebhookEventProcessed(event, { serviceClient }) {
  const { error } = await serviceClient
    .from("billing_webhook_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("provider", BILLING_PROVIDER)
    .eq("provider_event_id", event.id);

  if (error) {
    throw new ApiError(500, "billing_webhook_store_failed", "Unable to update webhook event log.");
  }
}

async function syncFromCheckoutSession(session, { serviceClient, config, env }) {
  if (session.mode === "payment" && session.metadata?.billing_flow === STRIPE_VERIFICATION_FLOW) {
    const parentId = String(session.metadata?.parent_id || "").trim();
    if (!parentId) {
      return { skipped: true, reason: "missing_parent" };
    }

    const providerCustomerId = typeof session.customer === "string" ? session.customer : null;
    if (!providerCustomerId) {
      return { skipped: true, reason: "missing_customer" };
    }

    if (String(session.payment_status || "").trim().toLowerCase() !== "paid") {
      return { skipped: true, reason: "verification_payment_not_paid" };
    }

    const row = await upsertBillingSubscription(
      {
        parent_id: parentId,
        provider_customer_id: providerCustomerId,
        provider_price_id: config.stripe.priceIdFamilyMonthly,
        parent_verification_completed_at: new Date().toISOString(),
        parent_verification_payment_intent_id:
          typeof session.payment_intent === "string" ? session.payment_intent : null,
        parent_verification_amount_cents:
          typeof session.amount_total === "number" ? session.amount_total : null,
        parent_verification_currency: String(session.currency || "").trim().toLowerCase() || null
      },
      { serviceClient }
    );

    const consent = await maybeGrantCoppaConsentFromVerification(parentId, { serviceClient, env });

    return {
      skipped: false,
      row,
      consent
    };
  }

  if (session.mode !== "subscription") {
    return { skipped: true, reason: "unsupported_checkout_mode" };
  }

  const parentId = String(session.metadata?.parent_id || "").trim();
  if (!parentId) {
    return { skipped: true, reason: "missing_parent" };
  }

  const providerCustomerId = typeof session.customer === "string" ? session.customer : null;
  const providerSubscriptionId = typeof session.subscription === "string" ? session.subscription : null;

  if (!providerCustomerId) {
    return { skipped: true, reason: "missing_customer" };
  }

  const row = await upsertBillingSubscription(
    {
      parent_id: parentId,
      provider_customer_id: providerCustomerId,
      provider_subscription_id: providerSubscriptionId,
      provider_price_id: config.stripe.priceIdFamilyMonthly,
      status: providerSubscriptionId ? "incomplete" : "incomplete"
    },
    { serviceClient }
  );

  let consent = null;
  if (String(session.payment_status || "").trim().toLowerCase() === "paid") {
    consent = await setParentCoppaConsentState(
      parentId,
      {
        status: COPPA_CONSENT_STATUS.granted,
        method: STRIPE_SUBSCRIPTION_CHECKOUT_CONSENT_METHOD,
        actorParentId: parentId
      },
      { serviceClient, env }
    );

    await upsertBillingSubscription(
      {
        parent_id: parentId,
        provider_customer_id: providerCustomerId,
        provider_subscription_id: providerSubscriptionId,
        provider_price_id: config.stripe.priceIdFamilyMonthly,
        parent_verification_completed_at: new Date().toISOString(),
        parent_verification_payment_intent_id:
          typeof session.payment_intent === "string" ? session.payment_intent : null,
        parent_verification_amount_cents:
          typeof session.amount_total === "number" ? session.amount_total : null,
        parent_verification_currency: String(session.currency || "").trim().toLowerCase() || null
      },
      { serviceClient }
    );
  }

  return {
    skipped: false,
    row,
    consent
  };
}

async function syncFromStripeSubscription(subscription, options = {}) {
  const env = options.env ?? process.env;
  const serviceClient = options.serviceClient ?? getServiceSupabaseClient();
  const event = options.event ?? null;
  const incomingEventCreatedAt = eventCreatedAtIso(event);
  const incomingEventId = String(event?.id || "").trim() || null;
  const parentId = await resolveParentIdForStripeSubscription(subscription, { serviceClient });

  if (!parentId) {
    return { skipped: true, reason: "missing_parent" };
  }

  const existing = await findBillingRowByStripeIds({
    providerSubscriptionId: subscription?.id ?? null,
    providerCustomerId: typeof subscription?.customer === "string" ? subscription.customer : null,
    serviceClient
  });

  if (isIncomingEventStale(existing, incomingEventCreatedAt)) {
    return { skipped: true, reason: "stale_event" };
  }

  const row = await upsertBillingSubscription(
    mapStripeSubscriptionToBillingRow(parentId, subscription, {
      eventCreatedAt: incomingEventCreatedAt,
      eventId: incomingEventId
    }),
    {
      serviceClient
    }
  );

  return { skipped: false, row };
}

async function reconcileBillingRowWithStripe(localRow, options = {}) {
  const env = options.env ?? process.env;
  const config = options.config ?? getStripeBillingConfig(env);
  const serviceClient = options.serviceClient ?? getServiceSupabaseClient();
  const stripeClient = options.stripeClient ?? getStripeClient(env);
  const dryRun = Boolean(options.dryRun);
  const nowIso = typeof options.nowIso === "string" ? options.nowIso : new Date().toISOString();

  const providerSubscriptionId = String(localRow?.provider_subscription_id || "").trim() || null;
  const providerCustomerId = String(localRow?.provider_customer_id || "").trim() || null;

  if (!providerSubscriptionId && !providerCustomerId) {
    return { skipped: true, reason: "missing_stripe_ids" };
  }

  let subscription = null;

  if (providerSubscriptionId) {
    try {
      subscription = await stripeClient.subscriptions.retrieve(providerSubscriptionId, {
        expand: ["items.data.price"]
      });
    } catch (error) {
      if (!isStripeResourceMissingError(error)) {
        throw error;
      }

      if (!dryRun) {
        await upsertBillingSubscription(
          buildCanceledRowFromMissingStripeResource(localRow, nowIso, config),
          { serviceClient }
        );
      }

      return {
        skipped: false,
        reason: "stripe_subscription_missing",
        marked_canceled: true
      };
    }
  } else if (providerCustomerId) {
    try {
      const customer = await stripeClient.customers.retrieve(providerCustomerId);
      if (customer?.deleted) {
        if (!dryRun) {
          await upsertBillingSubscription(
            buildCanceledRowFromMissingStripeResource(localRow, nowIso, config),
            { serviceClient }
          );
        }
        return {
          skipped: false,
          reason: "stripe_customer_deleted",
          marked_canceled: true
        };
      }
    } catch (error) {
      if (!isStripeResourceMissingError(error)) {
        throw error;
      }

      if (!dryRun) {
        await upsertBillingSubscription(
          buildCanceledRowFromMissingStripeResource(localRow, nowIso, config),
          { serviceClient }
        );
      }

      return {
        skipped: false,
        reason: "stripe_customer_missing",
        marked_canceled: true
      };
    }

    const listed = await stripeClient.subscriptions.list({
      customer: providerCustomerId,
      status: "all",
      limit: 1,
      expand: ["data.items.data.price"]
    });

    subscription = Array.isArray(listed?.data) ? listed.data[0] ?? null : null;
    if (!subscription) {
      if (!dryRun) {
        await upsertBillingSubscription(
          buildCanceledRowFromMissingStripeResource(localRow, nowIso, config),
          { serviceClient }
        );
      }
      return {
        skipped: false,
        reason: "stripe_subscription_missing_for_customer",
        marked_canceled: true
      };
    }
  }

  if (!subscription) {
    return { skipped: true, reason: "no_subscription_found" };
  }

  if (dryRun) {
    const parentId = await resolveParentIdForStripeSubscription(subscription, { serviceClient });
    if (!parentId) {
      return { skipped: true, reason: "missing_parent" };
    }

    return {
      skipped: false,
      reason: "dry_run_syncable_subscription",
      status: normalizeStatus(subscription.status),
      provider_subscription_id: subscription.id
    };
  }

  return syncFromStripeSubscription(subscription, { env, config, serviceClient, event: null });
}

export async function reconcileStripeBillingSubscriptions(options = {}) {
  const env = options.env ?? process.env;
  const config = options.config ?? getStripeBillingConfig(env);
  if (!config.enabled) {
    throw new ApiError(409, "billing_not_enabled", "Subscription billing is not enabled.");
  }

  const serviceClient = options.serviceClient ?? getServiceSupabaseClient();
  const stripeClient = options.stripeClient ?? getStripeClient(env);
  const scope = BILLING_RECONCILE_SCOPES.has(String(options.scope || "").trim())
    ? String(options.scope || "").trim()
    : "problem";
  const dryRun = Boolean(options.dryRun);
  const defaultLimit = scope === "full" ? 1000 : 250;
  const envLimit =
    scope === "full"
      ? env.BILLING_RECONCILE_FULL_LIMIT
      : env.BILLING_RECONCILE_PROBLEM_LIMIT;
  const limit = parsePositiveInteger(options.limit, parsePositiveInteger(envLimit, defaultLimit));

  const rows = await listBillingRowsForReconciliation({ serviceClient, scope, limit });

  const result = {
    scope,
    dry_run: dryRun,
    scanned: rows.length,
    updated: 0,
    skipped: 0,
    marked_canceled: 0,
    errors: 0,
    limit,
    details: []
  };

  for (const row of rows) {
    try {
      const outcome = await reconcileBillingRowWithStripe(row, {
        env,
        config,
        serviceClient,
        stripeClient,
        dryRun
      });

      const skipped = Boolean(outcome?.skipped);
      if (skipped) {
        result.skipped += 1;
      } else {
        result.updated += 1;
      }

      if (outcome?.marked_canceled) {
        result.marked_canceled += 1;
      }

      if (result.details.length < 25) {
        result.details.push({
          parent_id: row.parent_id,
          provider_customer_id: row.provider_customer_id ?? null,
          provider_subscription_id: row.provider_subscription_id ?? null,
          previous_status: normalizeStatus(row.status),
          skipped,
          reason: outcome?.reason ?? null,
          next_status: outcome?.status ?? null
        });
      }
    } catch (error) {
      result.errors += 1;
      if (result.details.length < 25) {
        result.details.push({
          parent_id: row.parent_id,
          provider_customer_id: row.provider_customer_id ?? null,
          provider_subscription_id: row.provider_subscription_id ?? null,
          previous_status: normalizeStatus(row.status),
          skipped: true,
          reason: "reconcile_error",
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  }

  return result;
}

export async function processStripeWebhookEvent(event, options = {}) {
  const env = options.env ?? process.env;
  const config = options.config ?? getStripeBillingConfig(env);
  const serviceClient = options.serviceClient ?? getServiceSupabaseClient();

  if (!config.enabled) {
    throw new ApiError(404, "billing_not_enabled", "Subscription billing is not enabled.");
  }

  const receipt = await recordWebhookEventStart(event, { serviceClient });
  if (receipt.alreadyProcessed) {
    return { duplicate: true, processed: true, event_type: event.type };
  }

  const object = event?.data?.object;
  let outcome = {
    skipped: false,
    reason: null
  };

  if (event.type === "checkout.session.completed") {
    outcome = (await syncFromCheckoutSession(object, { serviceClient, config, env })) ?? outcome;
  } else if (SYNCABLE_STRIPE_EVENT_TYPES.has(event.type)) {
    outcome = (await syncFromStripeSubscription(object, { env, config, serviceClient, event })) ?? outcome;
  } else {
    outcome = {
      skipped: true,
      reason: "ignored_event_type"
    };
  }

  await markWebhookEventProcessed(event, { serviceClient });

  return {
    duplicate: receipt.duplicate,
    processed: true,
    event_type: event.type,
    outcome: {
      skipped: Boolean(outcome?.skipped),
      reason: outcome?.reason ?? null
    }
  };
}
