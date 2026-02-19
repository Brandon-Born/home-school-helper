import { ApiError } from "../api-error.js";
import { getServiceSupabaseClient } from "../supabase-clients.js";
import { normalizeChildProfilePayload } from "./payload-normalizers.js";
import { ensureParentHasCoppaConsent } from "./coppa-consent-service.js";

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

  await ensureParentHasCoppaConsent(parentId, { serviceClient, env: options.env });

  const { data, error } = await serviceClient
    .from("children")
    .insert({
      ...normalized,
      parent_id: parentId
    })
    .select("id, first_name, age, grade, subjects, profile_notes, special_needs, created_at")
    .single();

  if (error || !data) {
    throw new ApiError(500, "child_create_failed", "Unable to create child profile.");
  }

  return data;
}

export async function updateChildForParent(parentId, childId, payload, options = {}) {
  const serviceClient = options.serviceClient ?? getServiceSupabaseClient();
  const normalized = normalizeChildProfilePayload(payload);

  const { data, error } = await serviceClient
    .from("children")
    .update(normalized)
    .eq("id", childId)
    .eq("parent_id", parentId)
    .select("id, first_name, age, grade, subjects, profile_notes, special_needs, created_at")
    .single();

  if (error || !data) {
    throw new ApiError(404, "child_not_found", "Child profile not found for this parent.");
  }

  return data;
}

export async function deleteChildForParent(parentId, childId, options = {}) {
  const serviceClient = options.serviceClient ?? getServiceSupabaseClient();

  // Verify ownership first
  const { data: child, error: lookupError } = await serviceClient
    .from("children")
    .select("id")
    .eq("id", childId)
    .eq("parent_id", parentId)
    .maybeSingle();

  if (lookupError) {
    throw new ApiError(500, "child_lookup_failed", "Unable to verify child ownership.");
  }

  if (!child) {
    throw new ApiError(404, "child_not_found", "Child profile not found for this parent.");
  }

  // Block deletion if child has an active session
  const { data: activeSessions, error: sessionError } = await serviceClient
    .from("sessions")
    .select("id")
    .eq("child_id", childId)
    .eq("status", "active")
    .limit(1);

  if (sessionError) {
    throw new ApiError(500, "session_lookup_failed", "Unable to check active sessions.");
  }

  if (Array.isArray(activeSessions) && activeSessions.length > 0) {
    throw new ApiError(409, "active_session_exists", "Cannot delete a child with an active session. End the session first.");
  }

  const { error: deleteError } = await serviceClient
    .from("children")
    .delete()
    .eq("id", childId)
    .eq("parent_id", parentId);

  if (deleteError) {
    throw new ApiError(500, "child_delete_failed", "Unable to delete child profile.");
  }
}
