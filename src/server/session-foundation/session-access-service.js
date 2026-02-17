import { ApiError } from "../api-error.js";
import { getServiceSupabaseClient } from "../supabase-clients.js";

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
