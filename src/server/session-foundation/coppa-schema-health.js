import { ApiError } from "../api-error.js";
import { getServiceSupabaseClient } from "../supabase-clients.js";
import { isCoppaSchemaMissingError } from "./coppa-consent-service.js";

const PARENT_SCHEMA_PROBE_SELECT =
  "coppa_consent_status, coppa_consent_updated_at, coppa_policy_version, coppa_consent_method";

export function shouldRunCoppaStartupSchemaCheck(env = process.env) {
  const configured = String(env.COPPA_STARTUP_SCHEMA_CHECK ?? "").trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(configured)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(configured)) {
    return false;
  }

  return String(env.NODE_ENV || "").trim().toLowerCase() === "production";
}

export async function assertCoppaSchemaReady(options = {}) {
  const serviceClient = options.serviceClient ?? getServiceSupabaseClient();
  const probeParentId = String(options.probeParentId || "__coppa_schema_probe__");

  const { error: parentError } = await serviceClient
    .from("parents")
    .select(PARENT_SCHEMA_PROBE_SELECT)
    .eq("id", probeParentId)
    .maybeSingle();

  if (parentError) {
    if (isCoppaSchemaMissingError(parentError)) {
      throw new ApiError(
        500,
        "coppa_schema_missing",
        "COPPA schema check failed: parent consent columns are missing."
      );
    }
    throw new ApiError(500, "coppa_schema_check_failed", "COPPA schema check failed.");
  }

  const { error: consentTableError } = await serviceClient
    .from("parent_consents")
    .select("id")
    .limit(1);

  if (consentTableError) {
    if (isCoppaSchemaMissingError(consentTableError)) {
      throw new ApiError(500, "coppa_schema_missing", "COPPA schema check failed: parent_consents table is missing.");
    }
    throw new ApiError(500, "coppa_schema_check_failed", "COPPA schema check failed.");
  }
}
