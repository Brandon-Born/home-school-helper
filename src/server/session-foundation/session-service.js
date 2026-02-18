import { ApiError } from "../api-error.js";
import {
  createChildSessionToken,
  generateJoinCode,
  hashOpaqueToken
} from "../session-codes.js";
import { getServiceSupabaseClient } from "../supabase-clients.js";
import {
  normalizeSessionJoinPayload,
  normalizeSessionStartPayload
} from "./payload-normalizers.js";

const JOIN_CODE_TTL_MINUTES = 10;
const CHILD_SESSION_TTL_HOURS = 12;

function hasMissingActiveJoinCodeColumns(error) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("active_join_code");
}

export async function startSessionForParent(parentId, payload, options = {}) {
  const serviceClient = options.serviceClient ?? getServiceSupabaseClient();
  const normalized = normalizeSessionStartPayload(payload);
  const joinCode = generateJoinCode(8);
  const codeHash = hashOpaqueToken(joinCode);
  const expiresAt = new Date(Date.now() + JOIN_CODE_TTL_MINUTES * 60 * 1000).toISOString();

  const { data: child, error: childError } = await serviceClient
    .from("children")
    .select("id, first_name")
    .eq("id", normalized.child_id)
    .eq("parent_id", parentId)
    .maybeSingle();

  if (childError) {
    throw new ApiError(500, "child_lookup_failed", "Unable to validate child for session start.");
  }

  if (!child) {
    throw new ApiError(404, "child_not_found", "Child profile not found for this parent.");
  }

  const { data: activeSessions, error: activeError } = await serviceClient
    .from("sessions")
    .select("id")
    .eq("child_id", normalized.child_id)
    .eq("status", "active")
    .limit(1);

  if (activeError) {
    throw new ApiError(500, "session_lookup_failed", "Unable to check active session status.");
  }

  if (Array.isArray(activeSessions) && activeSessions.length > 0) {
    throw new ApiError(409, "active_session_exists", "Child already has an active session.");
  }

  const dailyContext = {
    daily_subjects: normalized.daily_subjects,
    parent_context: normalized.parent_context,
    goal_notes: normalized.goal_notes,
    additional_context: normalized.additional_context
  };

  let session;
  let sessionError;

  ({ data: session, error: sessionError } = await serviceClient
    .from("sessions")
    .insert({
      child_id: normalized.child_id,
      parent_id: parentId,
      status: "active",
      daily_context: dailyContext,
      active_join_code: joinCode,
      active_join_code_expires_at: expiresAt
    })
    .select("id, child_id, parent_id, status, daily_context, started_at, active_join_code, active_join_code_expires_at")
    .single());

  if (sessionError && hasMissingActiveJoinCodeColumns(sessionError)) {
    ({ data: session, error: sessionError } = await serviceClient
      .from("sessions")
      .insert({
        child_id: normalized.child_id,
        parent_id: parentId,
        status: "active",
        daily_context: dailyContext
      })
      .select("id, child_id, parent_id, status, daily_context, started_at")
      .single());
  }

  if (sessionError || !session) {
    throw new ApiError(500, "session_create_failed", "Unable to start session.");
  }

  const { error: codeError } = await serviceClient.from("session_codes").insert({
    session_id: session.id,
    code_hash: codeHash,
    expires_at: expiresAt
  });

  if (codeError) {
    throw new ApiError(500, "session_code_create_failed", "Unable to create one-time session code.");
  }

  return {
    session_id: session.id,
    child_id: session.child_id,
    child_name: child.first_name ?? "Unknown",
    status: session.status,
    started_at: session.started_at ?? new Date().toISOString(),
    join_code: session.active_join_code ?? joinCode,
    expires_at: session.active_join_code_expires_at ?? expiresAt,
    daily_context: session.daily_context
  };
}

export async function redeemSessionCode(payload, options = {}) {
  const serviceClient = options.serviceClient ?? getServiceSupabaseClient();
  const normalized = normalizeSessionJoinPayload(payload);
  const codeHash = hashOpaqueToken(normalized.code);

  const { data: codeRow, error: codeError } = await serviceClient
    .from("session_codes")
    .select("id, session_id, expires_at, redeemed_at")
    .eq("code_hash", codeHash)
    .maybeSingle();

  if (codeError) {
    throw new ApiError(500, "session_code_lookup_failed", "Unable to validate session code.");
  }

  if (!codeRow) {
    throw new ApiError(404, "session_code_invalid", "Session code is invalid.");
  }

  if (codeRow.redeemed_at) {
    throw new ApiError(409, "session_code_used", "Session code has already been redeemed.");
  }

  const nowIso = new Date().toISOString();
  if (new Date(codeRow.expires_at).getTime() <= Date.now()) {
    throw new ApiError(410, "session_code_expired", "Session code has expired.");
  }

  const { data: sessionRow, error: sessionError } = await serviceClient
    .from("sessions")
    .select("id, child_id, status")
    .eq("id", codeRow.session_id)
    .maybeSingle();

  if (sessionError || !sessionRow) {
    throw new ApiError(500, "session_lookup_failed", "Unable to resolve session for this code.");
  }

  if (sessionRow.status !== "active") {
    throw new ApiError(409, "session_not_active", "Session is not active.");
  }

  const { data: updateRow, error: updateError } = await serviceClient
    .from("session_codes")
    .update({
      redeemed_at: nowIso,
      redeemed_device_fingerprint: normalized.device_fingerprint
    })
    .eq("id", codeRow.id)
    .is("redeemed_at", null)
    .select("id")
    .maybeSingle();

  if (updateError) {
    throw new ApiError(500, "session_code_redeem_failed", "Unable to redeem session code.");
  }

  if (!updateRow) {
    throw new ApiError(409, "session_code_used", "Session code has already been redeemed.");
  }

  const { error: clearActiveCodeError } = await serviceClient
    .from("sessions")
    .update({
      active_join_code: null,
      active_join_code_expires_at: null
    })
    .eq("id", sessionRow.id)
    .eq("status", "active");

  if (clearActiveCodeError && !hasMissingActiveJoinCodeColumns(clearActiveCodeError)) {
    throw new ApiError(500, "session_update_failed", "Unable to update session join-code state.");
  }

  const childSessionToken = createChildSessionToken();
  const childSessionTokenHash = hashOpaqueToken(childSessionToken);
  const childTokenExpiresAt = new Date(Date.now() + CHILD_SESSION_TTL_HOURS * 60 * 60 * 1000).toISOString();

  const { error: childTokenError } = await serviceClient.from("child_session_tokens").insert({
    session_id: sessionRow.id,
    child_id: sessionRow.child_id,
    token_hash: childSessionTokenHash,
    expires_at: childTokenExpiresAt
  });

  if (childTokenError) {
    throw new ApiError(500, "child_session_token_failed", "Unable to issue child session token.");
  }

  return {
    session_id: sessionRow.id,
    child_id: sessionRow.child_id,
    child_session_token: childSessionToken,
    expires_at: childTokenExpiresAt
  };
}

export async function listActiveSessionsForParent(parentId, options = {}) {
  const serviceClient = options.serviceClient ?? getServiceSupabaseClient();

  let sessions;
  let error;

  ({ data: sessions, error } = await serviceClient
    .from("sessions")
    .select("id, child_id, status, daily_context, started_at, active_join_code, active_join_code_expires_at")
    .eq("parent_id", parentId)
    .eq("status", "active")
    .order("started_at", { ascending: false }));

  if (error && hasMissingActiveJoinCodeColumns(error)) {
    ({ data: sessions, error } = await serviceClient
      .from("sessions")
      .select("id, child_id, status, daily_context, started_at")
      .eq("parent_id", parentId)
      .eq("status", "active")
      .order("started_at", { ascending: false }));
  }

  if (error) {
    throw new ApiError(500, "sessions_fetch_failed", "Unable to fetch active sessions.");
  }

  if (!sessions || sessions.length === 0) {
    return [];
  }

  // Enrich with child names
  const childIds = [...new Set(sessions.map((s) => s.child_id))];
  const { data: children, error: childError } = await serviceClient
    .from("children")
    .select("id, first_name")
    .in("id", childIds);

  if (childError) {
    throw new ApiError(500, "children_lookup_failed", "Unable to fetch child names for sessions.");
  }

  const childMap = new Map((children ?? []).map((c) => [c.id, c.first_name]));

  return sessions.map((s) => ({
    session_id: s.id,
    child_id: s.child_id,
    child_name: childMap.get(s.child_id) ?? "Unknown",
    status: s.status,
    daily_context: s.daily_context,
    started_at: s.started_at,
    join_code: s.active_join_code,
    expires_at: s.active_join_code_expires_at
  }));
}

export async function endSessionForParent(parentId, sessionId, options = {}) {
  const serviceClient = options.serviceClient ?? getServiceSupabaseClient();

  let data;
  let error;

  ({ data, error } = await serviceClient
    .from("sessions")
    .update({
      status: "ended",
      ended_at: new Date().toISOString(),
      active_join_code: null,
      active_join_code_expires_at: null
    })
    .eq("id", sessionId)
    .eq("parent_id", parentId)
    .eq("status", "active")
    .select("id, status")
    .maybeSingle());

  if (error && hasMissingActiveJoinCodeColumns(error)) {
    ({ data, error } = await serviceClient
      .from("sessions")
      .update({
        status: "ended",
        ended_at: new Date().toISOString()
      })
      .eq("id", sessionId)
      .eq("parent_id", parentId)
      .eq("status", "active")
      .select("id, status")
      .maybeSingle());
  }

  if (error) {
    throw new ApiError(500, "session_end_failed", "Unable to end session.");
  }

  if (!data) {
    throw new ApiError(404, "session_not_found", "Active session not found for this parent.");
  }

  return data;
}

export async function regenerateJoinCodeForSession(parentId, sessionId, options = {}) {
  const serviceClient = options.serviceClient ?? getServiceSupabaseClient();

  // Verify parent owns the session and it's active
  const { data: session, error: sessionError } = await serviceClient
    .from("sessions")
    .select("id, child_id, status")
    .eq("id", sessionId)
    .eq("parent_id", parentId)
    .maybeSingle();

  if (sessionError) {
    throw new ApiError(500, "session_lookup_failed", "Unable to validate session.");
  }

  if (!session) {
    throw new ApiError(404, "session_not_found", "Session not found for this parent.");
  }

  if (session.status !== "active") {
    throw new ApiError(409, "session_not_active", "Session is not active.");
  }

  const joinCode = generateJoinCode(8);
  const codeHash = hashOpaqueToken(joinCode);
  const expiresAt = new Date(Date.now() + JOIN_CODE_TTL_MINUTES * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();

  const { error: expireError } = await serviceClient
    .from("session_codes")
    .update({ expires_at: nowIso })
    .eq("session_id", session.id)
    .is("redeemed_at", null)
    .gt("expires_at", nowIso);

  if (expireError) {
    throw new ApiError(500, "session_code_expire_failed", "Unable to expire previous join codes.");
  }

  const { error: codeError } = await serviceClient.from("session_codes").insert({
    session_id: session.id,
    code_hash: codeHash,
    expires_at: expiresAt
  });

  if (codeError) {
    throw new ApiError(500, "session_code_create_failed", "Unable to create new join code.");
  }

  const { error: sessionUpdateError } = await serviceClient
    .from("sessions")
    .update({
      active_join_code: joinCode,
      active_join_code_expires_at: expiresAt
    })
    .eq("id", session.id)
    .eq("status", "active");

  if (sessionUpdateError && !hasMissingActiveJoinCodeColumns(sessionUpdateError)) {
    throw new ApiError(500, "session_update_failed", "Unable to update session join-code metadata.");
  }

  return {
    session_id: session.id,
    join_code: joinCode,
    expires_at: expiresAt
  };
}
