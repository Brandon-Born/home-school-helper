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
  { sessionId, visibility = "all", limit = 100, order = "asc", afterCreatedAt = null },
  options = {}
) {
  const serviceClient = options.serviceClient ?? getServiceSupabaseClient();
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const ascendingOrder = order !== "desc";

  let query = serviceClient
    .from("messages")
    .select("id, actor_type, visibility_scope, content, policy_flags, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: ascendingOrder })
    .order("id", { ascending: ascendingOrder })
    .limit(safeLimit);

  if (visibility === "child") {
    query = query.eq("visibility_scope", "child_and_parent");
  }

  if (afterCreatedAt) {
    query = query.gte("created_at", String(afterCreatedAt));
  }

  const { data, error } = await query;
  if (error) {
    throw new ApiError(500, "messages_fetch_failed", "Unable to fetch session messages.");
  }

  return data ?? [];
}

function normalizeRealtimeMessageRow(row) {
  if (!row || typeof row !== "object") {
    return null;
  }

  return {
    id: row.id,
    actor_type: row.actor_type,
    visibility_scope: row.visibility_scope,
    content: row.content,
    policy_flags: Array.isArray(row.policy_flags) ? row.policy_flags : [],
    created_at: row.created_at
  };
}

export async function createSessionMessageSubscription(
  { sessionId, onMessage, onError },
  options = {}
) {
  const serviceClient = options.serviceClient ?? getServiceSupabaseClient();
  const channelName = `session-messages:${sessionId}:${Math.random().toString(36).slice(2, 10)}`;
  const channel = serviceClient.channel(channelName);

  let subscribed = false;
  let closed = false;

  await new Promise((resolve, reject) => {
    const resolveOnce = () => {
      if (subscribed || closed) {
        return;
      }
      subscribed = true;
      resolve();
    };

    const rejectOnce = (error) => {
      if (subscribed || closed) {
        return;
      }
      subscribed = true;
      reject(error);
    };

    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          if (closed) {
            return;
          }

          const message = normalizeRealtimeMessageRow(payload?.new);
          if (!message) {
            return;
          }

          Promise.resolve(onMessage?.(message)).catch((error) => {
            Promise.resolve(onError?.(error)).catch(() => {});
          });
        }
      )
      .subscribe((status, error) => {
        if (closed) {
          return;
        }

        if (status === "SUBSCRIBED") {
          resolveOnce();
          return;
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          const failure = error instanceof Error ? error : new Error(`Realtime subscribe failed: ${status}`);
          if (!subscribed) {
            rejectOnce(failure);
            Promise.resolve(serviceClient.removeChannel(channel)).catch(() => {});
          } else {
            Promise.resolve(onError?.(failure)).catch(() => {});
          }
          return;
        }

        if (status === "CLOSED" && subscribed) {
          Promise.resolve(onError?.(new Error("Realtime channel closed."))).catch(() => {});
        }
      });
  });

  return async function unsubscribe() {
    if (closed) {
      return;
    }
    closed = true;
    await serviceClient.removeChannel(channel);
  };
}
