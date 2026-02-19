import { ApiError } from "../api-error.js";
import { getServiceSupabaseClient } from "../supabase-clients.js";

const DEFAULT_TRANSCRIPT_RETENTION_DAYS = 30;
export const PRIVACY_REQUEST_TYPES = Object.freeze({
  export: "export",
  delete: "delete"
});

export const PRIVACY_REQUEST_STATUSES = Object.freeze({
  queued: "queued",
  processing: "processing",
  completed: "completed",
  failed: "failed"
});

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

function normalizeRequestType(rawType) {
  const normalized = String(rawType ?? "").trim().toLowerCase();
  if (normalized === PRIVACY_REQUEST_TYPES.export || normalized === PRIVACY_REQUEST_TYPES.delete) {
    return normalized;
  }

  throw new ApiError(400, "validation_error", "Request type must be 'export' or 'delete'.");
}

export async function listPrivacyRequestsForParent(parentId, options = {}) {
  const serviceClient = options.serviceClient ?? getServiceSupabaseClient();
  const limit = Math.min(25, Math.max(1, Number.parseInt(String(options.limit ?? 10), 10) || 10));

  const { data, error } = await serviceClient
    .from("privacy_requests")
    .select("id, request_type, status, reason, requested_at, completed_at, error_message, result_json")
    .eq("parent_id", parentId)
    .order("requested_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (String(error?.message || "").toLowerCase().includes("privacy_requests")) {
      return [];
    }

    throw new ApiError(500, "privacy_requests_fetch_failed", "Unable to fetch privacy requests.");
  }

  return data ?? [];
}

export async function createPrivacyRequestForParent(parentId, payload, options = {}) {
  const serviceClient = options.serviceClient ?? getServiceSupabaseClient();
  const requestType = normalizeRequestType(payload?.request_type);
  const actorParentId = payload?.actor_parent_id ?? parentId;
  const reason = String(payload?.reason ?? "").trim() || null;
  const clientAddress = payload?.client_address ?? null;
  const userAgent = payload?.user_agent ?? null;
  const nowIso = new Date().toISOString();

  const { data, error } = await serviceClient
    .from("privacy_requests")
    .insert({
      parent_id: parentId,
      actor_parent_id: actorParentId,
      request_type: requestType,
      status: PRIVACY_REQUEST_STATUSES.processing,
      reason,
      client_address: clientAddress,
      user_agent: userAgent,
      requested_at: nowIso
    })
    .select("id, request_type, status, reason, requested_at, completed_at, error_message, result_json")
    .single();

  if (error || !data) {
    throw new ApiError(500, "privacy_request_create_failed", "Unable to create privacy request.");
  }

  return data;
}

export async function markPrivacyRequestCompleted(requestId, result, options = {}) {
  const serviceClient = options.serviceClient ?? getServiceSupabaseClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await serviceClient
    .from("privacy_requests")
    .update({
      status: PRIVACY_REQUEST_STATUSES.completed,
      completed_at: nowIso,
      error_message: null,
      result_json: result ?? {}
    })
    .eq("id", requestId)
    .select("id, request_type, status, reason, requested_at, completed_at, error_message, result_json")
    .single();

  if (error || !data) {
    throw new ApiError(500, "privacy_request_update_failed", "Unable to complete privacy request.");
  }

  return data;
}

export async function markPrivacyRequestFailed(requestId, errorMessage, options = {}) {
  const serviceClient = options.serviceClient ?? getServiceSupabaseClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await serviceClient
    .from("privacy_requests")
    .update({
      status: PRIVACY_REQUEST_STATUSES.failed,
      completed_at: nowIso,
      error_message: String(errorMessage || "Unknown failure"),
      result_json: {}
    })
    .eq("id", requestId)
    .select("id, request_type, status, reason, requested_at, completed_at, error_message, result_json")
    .single();

  if (error || !data) {
    throw new ApiError(500, "privacy_request_update_failed", "Unable to mark privacy request as failed.");
  }

  return data;
}

export async function generateExportSnapshotForParent(parentId, options = {}) {
  const serviceClient = options.serviceClient ?? getServiceSupabaseClient();
  const summary = await getChildDataSummaryForParent(parentId, { serviceClient });

  const { data: children, error: childrenError } = await serviceClient
    .from("children")
    .select("id, first_name, age, grade, subjects, profile_notes, special_needs, created_at")
    .eq("parent_id", parentId)
    .order("created_at", { ascending: true });

  if (childrenError) {
    throw new ApiError(500, "privacy_export_children_failed", "Unable to build child-data export.");
  }

  const { data: sessions, error: sessionsError } = await serviceClient
    .from("sessions")
    .select("id, child_id, parent_id, status, daily_context, started_at, ended_at")
    .eq("parent_id", parentId)
    .order("started_at", { ascending: true });

  if (sessionsError) {
    throw new ApiError(500, "privacy_export_sessions_failed", "Unable to build session export.");
  }

  const sessionIds = (sessions ?? []).map((session) => session.id).filter(Boolean);
  let messages = [];
  if (sessionIds.length > 0) {
    const { data: messageRows, error: messageError } = await serviceClient
      .from("messages")
      .select("id, session_id, actor_type, visibility_scope, content, policy_flags, created_at")
      .in("session_id", sessionIds)
      .order("created_at", { ascending: true });

    if (messageError) {
      throw new ApiError(500, "privacy_export_messages_failed", "Unable to build transcript export.");
    }

    messages = messageRows ?? [];
  }

  return {
    generated_at: new Date().toISOString(),
    parent_id: parentId,
    summary,
    data: {
      children: children ?? [],
      sessions: sessions ?? [],
      messages
    }
  };
}

export async function deleteChildDataForParent(parentId, options = {}) {
  const serviceClient = options.serviceClient ?? getServiceSupabaseClient();
  const before = await getChildDataSummaryForParent(parentId, { serviceClient });

  const { error } = await serviceClient
    .from("children")
    .delete()
    .eq("parent_id", parentId);

  if (error) {
    throw new ApiError(500, "privacy_delete_failed", "Unable to delete child data.");
  }

  return {
    deleted_children: before.counts.children,
    deleted_sessions: before.counts.sessions,
    deleted_messages: before.counts.transcript_messages,
    requested_at: new Date().toISOString()
  };
}
