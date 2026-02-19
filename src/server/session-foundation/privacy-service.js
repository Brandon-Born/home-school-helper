import { ApiError } from "../api-error.js";
import { getServiceSupabaseClient } from "../supabase-clients.js";

const DEFAULT_TRANSCRIPT_RETENTION_DAYS = 30;

function minTimestamp(rows, key) {
  const values = rows
    .map((row) => row?.[key])
    .filter((value) => typeof value === "string" && value.trim());

  if (values.length === 0) {
    return null;
  }

  return values.reduce((currentMin, value) => {
    if (!currentMin) {
      return value;
    }

    return new Date(value).getTime() < new Date(currentMin).getTime() ? value : currentMin;
  }, null);
}

function maxTimestamp(rows, key) {
  const values = rows
    .map((row) => row?.[key])
    .filter((value) => typeof value === "string" && value.trim());

  if (values.length === 0) {
    return null;
  }

  return values.reduce((currentMax, value) => {
    if (!currentMax) {
      return value;
    }

    return new Date(value).getTime() > new Date(currentMax).getTime() ? value : currentMax;
  }, null);
}

export async function getChildDataSummaryForParent(parentId, options = {}) {
  const serviceClient = options.serviceClient ?? getServiceSupabaseClient();

  const { data: children, error: childrenError } = await serviceClient
    .from("children")
    .select("id, first_name, created_at, profile_notes, special_needs")
    .eq("parent_id", parentId)
    .order("created_at", { ascending: true });

  if (childrenError) {
    throw new ApiError(500, "privacy_summary_children_failed", "Unable to fetch child data summary.");
  }

  const { data: sessions, error: sessionsError } = await serviceClient
    .from("sessions")
    .select("id, child_id, status, started_at, ended_at")
    .eq("parent_id", parentId)
    .order("started_at", { ascending: true });

  if (sessionsError) {
    throw new ApiError(500, "privacy_summary_sessions_failed", "Unable to fetch session summary.");
  }

  const sessionIds = (sessions ?? []).map((session) => session.id).filter(Boolean);
  let messages = [];

  if (sessionIds.length > 0) {
    const { data: messageRows, error: messageError } = await serviceClient
      .from("messages")
      .select("id, session_id, actor_type, visibility_scope, created_at")
      .in("session_id", sessionIds)
      .order("created_at", { ascending: true });

    if (messageError) {
      throw new ApiError(500, "privacy_summary_messages_failed", "Unable to fetch transcript summary.");
    }

    messages = messageRows ?? [];
  }

  const childRows = children ?? [];
  const sessionRows = sessions ?? [];
  const messageRows = messages ?? [];

  const activeSessions = sessionRows.filter((session) => session.status === "active").length;
  const endedSessions = sessionRows.filter((session) => session.status === "ended").length;
  const pausedSessions = sessionRows.filter((session) => session.status === "paused").length;

  const childVisibleMessages = messageRows.filter(
    (message) => message.visibility_scope === "child_and_parent"
  ).length;
  const parentOnlyMessages = messageRows.filter(
    (message) => message.visibility_scope === "parent_only"
  ).length;

  return {
    generated_at: new Date().toISOString(),
    parent_id: parentId,
    retention: {
      transcript_days: DEFAULT_TRANSCRIPT_RETENTION_DAYS,
      raw_audio_stored: false
    },
    counts: {
      children: childRows.length,
      sessions: sessionRows.length,
      active_sessions: activeSessions,
      ended_sessions: endedSessions,
      paused_sessions: pausedSessions,
      transcript_messages: messageRows.length,
      child_visible_messages: childVisibleMessages,
      parent_only_messages: parentOnlyMessages
    },
    windows: {
      first_child_created_at: minTimestamp(childRows, "created_at"),
      last_child_created_at: maxTimestamp(childRows, "created_at"),
      first_session_started_at: minTimestamp(sessionRows, "started_at"),
      last_session_started_at: maxTimestamp(sessionRows, "started_at"),
      first_message_created_at: minTimestamp(messageRows, "created_at"),
      last_message_created_at: maxTimestamp(messageRows, "created_at")
    },
    children: childRows.map((child) => ({
      id: child.id,
      first_name: child.first_name ?? "Unknown",
      created_at: child.created_at ?? null,
      has_profile_notes: Boolean(String(child.profile_notes || "").trim()),
      has_special_needs: Boolean(String(child.special_needs || "").trim())
    })),
    categories: [
      "parent account",
      "child profiles",
      "session metadata",
      "transcript metadata"
    ]
  };
}
