import { ApiError } from "../api-error.js";
import { getServiceSupabaseClient } from "../supabase-clients.js";
import { ensureParentOwnsSession } from "./session-access-service.js";

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
