import { ApiError } from "./api-error.js";
import {
  createChildSessionToken,
  generateJoinCode,
  hashOpaqueToken,
  normalizeJoinCode
} from "./session-codes.js";
import { getServiceSupabaseClient } from "./supabase-clients.js";

const JOIN_CODE_TTL_MINUTES = 10;
const CHILD_SESSION_TTL_HOURS = 12;

function optionalText(value, maxLength = 2000) {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = String(value).trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, maxLength);
}

function ensureString(value, fieldName, maxLength = 120) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    throw new ApiError(400, "validation_error", `${fieldName} is required.`);
  }

  return trimmed.slice(0, maxLength);
}

function ensureAge(value) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < 4 || parsed > 21) {
    throw new ApiError(400, "validation_error", "age must be an integer between 4 and 21.");
  }
  return parsed;
}

function ensureSubjects(value, fieldName = "subjects") {
  if (!Array.isArray(value)) {
    throw new ApiError(400, "validation_error", `${fieldName} must be an array of strings.`);
  }

  const normalized = value
    .map((subject) => String(subject || "").trim())
    .filter(Boolean)
    .map((subject) => subject.slice(0, 64));

  if (normalized.length === 0) {
    throw new ApiError(400, "validation_error", `${fieldName} must include at least one subject.`);
  }

  if (normalized.length > 20) {
    throw new ApiError(400, "validation_error", `${fieldName} may include at most 20 entries.`);
  }

  return normalized;
}

export function normalizeChildProfilePayload(payload = {}) {
  return {
    first_name: ensureString(payload.first_name ?? payload.child_name, "child_name", 80),
    age: ensureAge(payload.age),
    grade: ensureString(payload.grade, "grade", 32),
    subjects: ensureSubjects(payload.subjects, "subjects"),
    profile_notes: optionalText(payload.profile_notes ?? payload.personality_description, 2000),
    special_needs: optionalText(payload.special_needs, 2000)
  };
}

export function normalizeSessionStartPayload(payload = {}) {
  return {
    child_id: ensureString(payload.child_id, "child_id", 64),
    daily_subjects: ensureSubjects(payload.daily_subjects ?? payload.subjects_for_day, "daily_subjects"),
    parent_context: optionalText(payload.parent_context, 4000),
    goal_notes: optionalText(payload.goal_notes, 2000),
    additional_context: optionalText(payload.additional_context, 2000)
  };
}

export function normalizeSessionJoinPayload(payload = {}) {
  const code = normalizeJoinCode(payload.code);
  if (!code || code.length < 6) {
    throw new ApiError(400, "validation_error", "code is required and must be at least 6 alphanumeric characters.");
  }

  return {
    code,
    device_fingerprint: optionalText(payload.device_fingerprint, 256)
  };
}

export async function listChildrenForParent(parentId, options = {}) {
  const serviceClient = options.serviceClient ?? getServiceSupabaseClient();
  const { data, error } = await serviceClient
    .from("children")
    .select("id, first_name, age, grade, subjects, profile_notes, special_needs, created_at")
    .eq("parent_id", parentId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new ApiError(500, "children_fetch_failed", "Unable to fetch children for this parent.");
  }

  return data ?? [];
}

export async function createChildForParent(parentId, payload, options = {}) {
  const serviceClient = options.serviceClient ?? getServiceSupabaseClient();
  const normalized = normalizeChildProfilePayload(payload);

  const insertPayload = {
    ...normalized,
    parent_id: parentId
  };

  const { data, error } = await serviceClient
    .from("children")
    .insert(insertPayload)
    .select("id, first_name, age, grade, subjects, profile_notes, special_needs, created_at")
    .single();

  if (error || !data) {
    throw new ApiError(500, "child_create_failed", "Unable to create child profile.");
  }

  return data;
}

export async function startSessionForParent(parentId, payload, options = {}) {
  const serviceClient = options.serviceClient ?? getServiceSupabaseClient();
  const normalized = normalizeSessionStartPayload(payload);

  const { data: child, error: childError } = await serviceClient
    .from("children")
    .select("id")
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

  const { data: session, error: sessionError } = await serviceClient
    .from("sessions")
    .insert({
      child_id: normalized.child_id,
      parent_id: parentId,
      status: "active",
      daily_context: dailyContext
    })
    .select("id, child_id, parent_id, status, daily_context, started_at")
    .single();

  if (sessionError || !session) {
    throw new ApiError(500, "session_create_failed", "Unable to start session.");
  }

  const joinCode = generateJoinCode(8);
  const codeHash = hashOpaqueToken(joinCode);
  const expiresAt = new Date(Date.now() + JOIN_CODE_TTL_MINUTES * 60 * 1000).toISOString();

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
    status: session.status,
    join_code: joinCode,
    expires_at: expiresAt,
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

export async function ensureParentOwnsSession(parentId, sessionId, options = {}) {
  const serviceClient = options.serviceClient ?? getServiceSupabaseClient();
  const { data, error } = await serviceClient
    .from("sessions")
    .select("id, child_id, parent_id, status")
    .eq("id", sessionId)
    .eq("parent_id", parentId)
    .maybeSingle();

  if (error) {
    throw new ApiError(500, "session_lookup_failed", "Unable to validate session ownership.");
  }

  if (!data) {
    throw new ApiError(404, "session_not_found", "Session not found for this parent.");
  }

  return data;
}

export async function persistSessionMessage(
  { sessionId, actorType, visibilityScope, content, policyFlags = [] },
  options = {}
) {
  const serviceClient = options.serviceClient ?? getServiceSupabaseClient();
  const trimmedContent = String(content || "").trim();
  if (!trimmedContent) {
    return null;
  }

  const { data, error } = await serviceClient
    .from("messages")
    .insert({
      session_id: sessionId,
      actor_type: actorType,
      visibility_scope: visibilityScope,
      content: trimmedContent,
      policy_flags: policyFlags
    })
    .select("id, created_at")
    .maybeSingle();

  if (error) {
    throw new ApiError(500, "message_persist_failed", "Unable to persist session message.");
  }

  return data;
}

export async function listSessionMessages(
  { sessionId, visibility = "all", limit = 100 },
  options = {}
) {
  const serviceClient = options.serviceClient ?? getServiceSupabaseClient();
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);

  let query = serviceClient
    .from("messages")
    .select("id, actor_type, visibility_scope, content, policy_flags, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(safeLimit);

  if (visibility === "child") {
    query = query.eq("visibility_scope", "child_and_parent");
  }

  const { data, error } = await query;
  if (error) {
    throw new ApiError(500, "messages_fetch_failed", "Unable to fetch session messages.");
  }

  return data ?? [];
}

export async function setSessionDirectAnswerOverride(
  { sessionId, parentId, enabled, durationMinutes = 10 },
  options = {}
) {
  const serviceClient = options.serviceClient ?? getServiceSupabaseClient();
  await ensureParentOwnsSession(parentId, sessionId, options);

  const now = new Date();
  const nowIso = now.toISOString();
  const boundedMinutes = Math.min(Math.max(Number(durationMinutes) || 10, 1), 60);

  const { error: revokeError } = await serviceClient
    .from("overrides")
    .update({
      enabled: false,
      expires_at: nowIso
    })
    .eq("session_id", sessionId)
    .eq("parent_id", parentId)
    .eq("enabled", true)
    .gt("expires_at", nowIso);

  if (revokeError) {
    throw new ApiError(500, "override_update_failed", "Unable to update active override state.");
  }

  if (!enabled) {
    return {
      session_id: sessionId,
      direct_answer_enabled: false,
      expires_at: nowIso
    };
  }

  const expiresAt = new Date(now.getTime() + boundedMinutes * 60 * 1000).toISOString();
  const { error: insertError } = await serviceClient.from("overrides").insert({
    session_id: sessionId,
    parent_id: parentId,
    enabled: true,
    expires_at: expiresAt
  });

  if (insertError) {
    throw new ApiError(500, "override_update_failed", "Unable to create direct-answer override.");
  }

  return {
    session_id: sessionId,
    direct_answer_enabled: true,
    expires_at: expiresAt
  };
}

export async function getSessionTutorContext(
  { sessionId, childId = null, parentId = null },
  options = {}
) {
  const serviceClient = options.serviceClient ?? getServiceSupabaseClient();

  const { data: session, error: sessionError } = await serviceClient
    .from("sessions")
    .select("id, child_id, parent_id, status, daily_context")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError || !session) {
    throw new ApiError(404, "session_not_found", "Session not found.");
  }

  if (childId && session.child_id !== childId) {
    throw new ApiError(403, "session_forbidden", "Session does not match child context.");
  }

  if (parentId && session.parent_id !== parentId) {
    throw new ApiError(403, "session_forbidden", "Session does not match parent context.");
  }

  if (session.status !== "active") {
    throw new ApiError(409, "session_not_active", "Session is not active.");
  }

  const { data: child, error: childError } = await serviceClient
    .from("children")
    .select("id, first_name, age, grade, subjects, profile_notes, special_needs")
    .eq("id", session.child_id)
    .maybeSingle();

  if (childError || !child) {
    throw new ApiError(500, "child_lookup_failed", "Unable to fetch child profile for session.");
  }

  const { data: guidanceRows, error: guidanceError } = await serviceClient
    .from("messages")
    .select("content")
    .eq("session_id", session.id)
    .eq("actor_type", "parent")
    .eq("visibility_scope", "parent_only")
    .order("created_at", { ascending: false })
    .limit(1);

  if (guidanceError) {
    throw new ApiError(500, "guidance_lookup_failed", "Unable to fetch latest parent guidance.");
  }

  const { data: overrideRows, error: overrideError } = await serviceClient
    .from("overrides")
    .select("id")
    .eq("session_id", session.id)
    .eq("enabled", true)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1);

  if (overrideError) {
    throw new ApiError(500, "override_lookup_failed", "Unable to evaluate direct-answer override.");
  }

  return {
    session,
    profile: child,
    dailyContext: session.daily_context ?? {},
    latestParentGuidance: guidanceRows?.[0]?.content ?? null,
    allowDirectAnswer: Array.isArray(overrideRows) && overrideRows.length > 0
  };
}
