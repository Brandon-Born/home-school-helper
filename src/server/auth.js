import { ApiError } from "./api-error.js";
import { hashOpaqueToken } from "./session-codes.js";
import {
  getAnonSupabaseClient,
  getServiceSupabaseClient
} from "./supabase-clients.js";
import {
  PARENT_PROFILE_SELECT,
  isCoppaSchemaMissingError,
  withCoppaConsentDefaults
} from "./session-foundation/coppa-consent-service.js";

export function getBearerToken(request) {
  const header = request.headers.get("authorization") || "";
  const [scheme, token] = header.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token?.trim()) {
    throw new ApiError(401, "missing_authorization", "Authorization header with Bearer token is required.");
  }

  return token.trim();
}

export async function requireParentContext(request, options = {}) {
  const accessToken = getBearerToken(request);
  const anonClient = options.anonClient ?? getAnonSupabaseClient();
  const serviceClient = options.serviceClient ?? getServiceSupabaseClient();

  const { data: userData, error: userError } = await anonClient.auth.getUser(accessToken);
  if (userError || !userData?.user) {
    throw new ApiError(401, "invalid_parent_token", "Parent access token is invalid or expired.");
  }

  const user = userData.user;
  const parentPayload = {
    auth_user_id: user.id,
    email: user.email ?? null,
    full_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null
  };

  let parent;
  let parentError;

  ({ data: parent, error: parentError } = await serviceClient
    .from("parents")
    .upsert(parentPayload, { onConflict: "auth_user_id" })
    .select(PARENT_PROFILE_SELECT)
    .single());

  if (parentError && isCoppaSchemaMissingError(parentError)) {
    ({ data: parent, error: parentError } = await serviceClient
      .from("parents")
      .upsert(parentPayload, { onConflict: "auth_user_id" })
      .select("id, auth_user_id, email, full_name, onboarding_completed, created_at")
      .single());

    if (!parentError && parent) {
      parent = {
        ...parent,
        coppa_consent_required: false,
        coppa_consent_status: "granted",
        coppa_consent_updated_at: null,
        coppa_policy_version: null,
        coppa_consent_method: null
      };
    }
  }

  if (parentError || !parent) {
    throw new ApiError(500, "parent_sync_failed", "Unable to create or fetch parent profile.");
  }

  return {
    accessToken,
    user,
    parent: withCoppaConsentDefaults(parent)
  };
}

export async function requireChildSessionContext(request, sessionId, options = {}) {
  const childToken = getBearerToken(request);
  const serviceClient = options.serviceClient ?? getServiceSupabaseClient();

  const tokenHash = hashOpaqueToken(childToken);
  const nowIso = new Date().toISOString();

  const { data: tokenRow, error: tokenError } = await serviceClient
    .from("child_session_tokens")
    .select("id, session_id, child_id, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .eq("session_id", sessionId)
    .is("revoked_at", null)
    .gt("expires_at", nowIso)
    .maybeSingle();

  if (tokenError || !tokenRow) {
    throw new ApiError(401, "invalid_child_session_token", "Child session token is invalid or expired.");
  }

  return {
    childToken,
    tokenRow
  };
}
