import { ApiError } from "../api-error.js";
import { getServiceSupabaseClient } from "../supabase-clients.js";
import { normalizeSessionMemory } from "./session-memory-service.js";

const TUTOR_PROMPT_RECENT_MESSAGE_LIMIT = 8;
const PARENT_GUIDANCE_LINE_MAX_CHARS = 280;

function sanitizeGuidanceLine(value) {
  const normalized = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return "";
  }

  if (normalized.length <= PARENT_GUIDANCE_LINE_MAX_CHARS) {
    return normalized;
  }

  return `${normalized.slice(0, PARENT_GUIDANCE_LINE_MAX_CHARS - 1)}…`;
}

function buildParentGuidanceContext({
  latestMessageGuidance,
  parentContext,
  memoryGuidance,
  memoryPriorities
}) {
  const lines = [];
  const pushUnique = (label, rawValue) => {
    const value = sanitizeGuidanceLine(rawValue);
    if (!value) {
      return;
    }

    const duplicate = lines.some((line) => line.toLowerCase().endsWith(value.toLowerCase()));
    if (!duplicate) {
      lines.push(`${label}: ${value}`);
    }
  };

  pushUnique("Session direction", parentContext);

  const normalizedPriorities = Array.isArray(memoryPriorities)
    ? memoryPriorities.map((item) => sanitizeGuidanceLine(item)).filter(Boolean)
    : [];
  for (const priority of normalizedPriorities.slice(-3)) {
    pushUnique("Persistent parent priority", priority);
  }

  pushUnique("Latest parent nudge", latestMessageGuidance);
  pushUnique("Memory fallback", memoryGuidance);

  if (lines.length === 0) {
    return null;
  }

  return lines.join("\n");
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

  const { data: recentMessageRows, error: recentMessagesError } = await serviceClient
    .from("messages")
    .select("id, actor_type, visibility_scope, content, created_at")
    .eq("session_id", session.id)
    .eq("visibility_scope", "child_and_parent")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(TUTOR_PROMPT_RECENT_MESSAGE_LIMIT);

  if (recentMessagesError) {
    throw new ApiError(500, "messages_fetch_failed", "Unable to fetch recent session transcript context.");
  }

  const recentMessages = Array.isArray(recentMessageRows)
    ? recentMessageRows
        .slice()
        .reverse()
        .map((row) => ({
          id: row.id,
          actor_type: row.actor_type,
          content: row.content,
          created_at: row.created_at
        }))
    : [];

  const sessionDailyContext =
    session.daily_context && typeof session.daily_context === "object"
      ? session.daily_context
      : {};
  const sessionMemory = normalizeSessionMemory(sessionDailyContext.session_memory);
  const { session_memory: _discardedSessionMemory, ...dailyContext } = sessionDailyContext;
  void _discardedSessionMemory;
  const latestParentGuidance = buildParentGuidanceContext({
    latestMessageGuidance: guidanceRows?.[0]?.content ?? null,
    parentContext: dailyContext.parent_context,
    memoryGuidance: sessionMemory.latest_parent_guidance,
    memoryPriorities: sessionMemory.parent_priorities
  });

  return {
    session,
    profile: child,
    dailyContext,
    sessionMemory,
    latestParentGuidance,
    allowDirectAnswer: Array.isArray(overrideRows) && overrideRows.length > 0,
    recentMessages
  };
}
