import { ApiError } from "../api-error.js";
import { getServiceSupabaseClient } from "../supabase-clients.js";

const DEFAULT_RETENTION_DAYS = 30;

export function computeTranscriptRetentionCutoffIso({
  now = new Date(),
  retentionDays = DEFAULT_RETENTION_DAYS
} = {}) {
  const normalizedDays = Number.parseInt(String(retentionDays), 10);
  if (!Number.isInteger(normalizedDays) || normalizedDays < 1) {
    throw new ApiError(400, "validation_error", "retentionDays must be an integer >= 1.");
  }

  const nowDate = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(nowDate.getTime())) {
    throw new ApiError(400, "validation_error", "now must be a valid date value.");
  }

  const cutoffMs = nowDate.getTime() - normalizedDays * 24 * 60 * 60 * 1000;
  return new Date(cutoffMs).toISOString();
}

export async function purgeExpiredTranscripts(
  { retentionDays = DEFAULT_RETENTION_DAYS, now } = {},
  options = {}
) {
  const serviceClient = options.serviceClient ?? getServiceSupabaseClient();
  const cutoffIso = computeTranscriptRetentionCutoffIso({
    now: now ?? new Date(),
    retentionDays
  });

  const query = serviceClient
    .from("messages")
    .delete({ count: "exact" })
    .lt("created_at", cutoffIso)
    .select("id");

  const { count, error } = await query;
  if (error) {
    throw new ApiError(500, "transcript_retention_failed", "Unable to purge expired transcripts.");
  }

  return {
    deleted_count: Number(count) || 0,
    retention_days: Number.parseInt(String(retentionDays), 10),
    cutoff_iso: cutoffIso
  };
}
