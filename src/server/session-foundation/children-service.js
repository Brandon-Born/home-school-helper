import { ApiError } from "../api-error.js";
import { getServiceSupabaseClient } from "../supabase-clients.js";
import { normalizeChildProfilePayload } from "./payload-normalizers.js";

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
