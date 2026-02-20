import { ApiError } from "../api-error.js";
import { getClientAddress } from "../rate-limit.js";
import { getServiceSupabaseClient } from "../supabase-clients.js";

export const COPPA_CONSENT_STATUS = Object.freeze({
  pending: "pending",
  granted: "granted",
  revoked: "revoked"
});

const MUTABLE_CONSENT_STATUSES = new Set([
  COPPA_CONSENT_STATUS.granted,
  COPPA_CONSENT_STATUS.revoked
]);

const CONSENT_REQUIRED_ENV_KEY = "COPPA_CONSENT_REQUIRED";
const COPPA_SCHEMA_FALLBACK_ENV_KEY = "ALLOW_COPPA_SCHEMA_FALLBACK";
const DEFAULT_POLICY_VERSION = "2026-02-19";
const DEFAULT_POLICY_URL = "/privacy";
const DEFAULT_CONSENT_METHOD = "parent_self_attestation";

const PARENT_CONSENT_SELECT =
  "coppa_consent_status, coppa_consent_updated_at, coppa_policy_version, coppa_consent_method";

export const PARENT_PROFILE_SELECT =
  "id, auth_user_id, email, full_name, onboarding_completed, coppa_consent_status, coppa_consent_updated_at, coppa_policy_version, coppa_consent_method, created_at";

export function isCoppaSchemaMissingError(error) {
  const message = String(error?.message || "").toLowerCase();
  const referencesCoppaSchema =
    message.includes("coppa_consent") || message.includes("parent_consents");
  const indicatesMissingDbObject =
    message.includes("does not exist") &&
    (message.includes("column") || message.includes("relation"));
  return referencesCoppaSchema && indicatesMissingDbObject;
}

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

export function isCoppaConsentRequired(env = process.env) {
  return parseBooleanEnv(env[CONSENT_REQUIRED_ENV_KEY], true);
}

export function isCoppaSchemaFallbackAllowed(env = process.env) {
  const nodeEnv = String(env.NODE_ENV ?? "").trim().toLowerCase();
  if (nodeEnv === "production") {
    return false;
  }

  return parseBooleanEnv(env[COPPA_SCHEMA_FALLBACK_ENV_KEY], false);
}

export function getCoppaPolicyVersion(env = process.env) {
  const value = String(env.COPPA_POLICY_VERSION ?? "").trim();
  return value || DEFAULT_POLICY_VERSION;
}

export function getCoppaPolicyUrl(env = process.env) {
  const value = String(env.COPPA_POLICY_URL ?? "").trim();
  return value || DEFAULT_POLICY_URL;
}

export function normalizeCoppaConsentStatus(rawStatus) {
  if (typeof rawStatus !== "string") {
    return COPPA_CONSENT_STATUS.pending;
  }

  const normalized = rawStatus.trim().toLowerCase();
  if (Object.values(COPPA_CONSENT_STATUS).includes(normalized)) {
    return normalized;
  }

  return COPPA_CONSENT_STATUS.pending;
}

function normalizeConsentMethod(rawMethod) {
  const trimmed = String(rawMethod ?? "").trim();
  return trimmed || DEFAULT_CONSENT_METHOD;
}

export function withCoppaConsentDefaults(parent, env = process.env) {
  const normalizedStatus = normalizeCoppaConsentStatus(parent?.coppa_consent_status);
  const consentMethod = parent?.coppa_consent_method ?? null;
  const consentRequired = parent?.coppa_consent_required ?? isCoppaConsentRequired(env);

  return {
    ...(parent ?? {}),
    coppa_consent_required: consentRequired,
    coppa_consent_status: normalizedStatus,
    coppa_consent_updated_at: parent?.coppa_consent_updated_at ?? null,
    coppa_policy_version: parent?.coppa_policy_version ?? getCoppaPolicyVersion(env),
    coppa_consent_method:
      normalizedStatus === COPPA_CONSENT_STATUS.pending
        ? null
        : normalizeConsentMethod(consentMethod)
  };
}

export async function getParentCoppaConsentState(parentId, options = {}) {
  const serviceClient = options.serviceClient ?? getServiceSupabaseClient();
  const env = options.env ?? process.env;

  const { data, error } = await serviceClient
    .from("parents")
    .select(PARENT_CONSENT_SELECT)
    .eq("id", parentId)
    .maybeSingle();

  if (error) {
    if (isCoppaSchemaMissingError(error) && isCoppaSchemaFallbackAllowed(env)) {
      return {
        required: false,
        status: COPPA_CONSENT_STATUS.granted,
        updated_at: null,
        policy_version: getCoppaPolicyVersion(env),
        policy_url: getCoppaPolicyUrl(env),
        method: null
      };
    }

    throw new ApiError(500, "coppa_consent_lookup_failed", "Unable to fetch parental consent status.");
  }

  if (!data) {
    throw new ApiError(404, "parent_not_found", "Parent profile not found.");
  }

  const normalized = withCoppaConsentDefaults(data, env);

  return {
    required: normalized.coppa_consent_required,
    status: normalized.coppa_consent_status,
    updated_at: normalized.coppa_consent_updated_at,
    policy_version: normalized.coppa_policy_version,
    policy_url: getCoppaPolicyUrl(env),
    method: normalized.coppa_consent_method
  };
}

export async function ensureParentHasCoppaConsent(parentId, options = {}) {
  const consent = await getParentCoppaConsentState(parentId, options);
  if (!consent.required) {
    return consent;
  }

  if (consent.status !== COPPA_CONSENT_STATUS.granted) {
    throw new ApiError(
      403,
      "coppa_consent_required",
      "Parental consent is required before creating child profiles or starting sessions."
    );
  }

  return consent;
}

export async function setParentCoppaConsentState(parentId, payload, options = {}) {
  const serviceClient = options.serviceClient ?? getServiceSupabaseClient();
  const env = options.env ?? process.env;
  const status = normalizeCoppaConsentStatus(payload?.status);
  const method = normalizeConsentMethod(payload?.method);
  const policyVersion = getCoppaPolicyVersion(env);
  const policyUrl = getCoppaPolicyUrl(env);
  const actorParentId = payload?.actorParentId ?? parentId;
  const nowIso = new Date().toISOString();

  if (!MUTABLE_CONSENT_STATUSES.has(status)) {
    throw new ApiError(400, "validation_error", "Consent status must be 'granted' or 'revoked'.");
  }

  const { data, error } = await serviceClient
    .from("parents")
    .update({
      coppa_consent_status: status,
      coppa_consent_updated_at: nowIso,
      coppa_policy_version: policyVersion,
      coppa_consent_method: method
    })
    .eq("id", parentId)
    .select(PARENT_CONSENT_SELECT)
    .single();

  if (error || !data) {
    if (isCoppaSchemaMissingError(error) && isCoppaSchemaFallbackAllowed(env)) {
      return {
        required: false,
        status: COPPA_CONSENT_STATUS.granted,
        updated_at: null,
        policy_version: policyVersion,
        policy_url: policyUrl,
        method: null
      };
    }

    throw new ApiError(500, "coppa_consent_update_failed", "Unable to update parental consent status.");
  }

  const request = options.request;
  const clientAddress = request ? getClientAddress(request) : null;
  const userAgent = request?.headers?.get("user-agent") ?? null;

  const { error: consentEventError } = await serviceClient.from("parent_consents").insert({
    parent_id: parentId,
    status,
    method,
    policy_version: policyVersion,
    policy_url: policyUrl,
    actor_parent_id: actorParentId,
    client_address: clientAddress,
    user_agent: userAgent
  });

  if (consentEventError) {
    if (isCoppaSchemaMissingError(consentEventError) && isCoppaSchemaFallbackAllowed(env)) {
      return {
        required: false,
        status: COPPA_CONSENT_STATUS.granted,
        updated_at: null,
        policy_version: policyVersion,
        policy_url: policyUrl,
        method: null
      };
    }

    throw new ApiError(500, "coppa_consent_audit_failed", "Unable to record parental consent event.");
  }

  const normalized = withCoppaConsentDefaults(data, env);

  return {
    required: normalized.coppa_consent_required,
    status: normalized.coppa_consent_status,
    updated_at: normalized.coppa_consent_updated_at,
    policy_version: normalized.coppa_policy_version,
    policy_url: policyUrl,
    method: normalized.coppa_consent_method
  };
}
