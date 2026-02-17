import { ApiError } from "../api-error.js";
import { getServiceSupabaseClient } from "../supabase-clients.js";

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
