import { ApiError } from "./api-error.js";
import { getServiceSupabaseClient } from "./supabase-clients.js";

const RATE_LIMIT_STORE = new Map();
const DISTRIBUTED_FALLBACK_WARNINGS = new Set();
const SUPPORTED_BACKENDS = new Set(["auto", "memory", "supabase"]);

function parseForwardedIp(value) {
  if (!value) {
    return "";
  }

  return String(value)
    .split(",")[0]
    .trim();
}

export function getClientAddress(request) {
  return (
    parseForwardedIp(request.headers.get("x-forwarded-for")) ||
    parseForwardedIp(request.headers.get("cf-connecting-ip")) ||
    parseForwardedIp(request.headers.get("x-real-ip")) ||
    "unknown"
  );
}

function pruneExpiredBuckets(nowMs) {
  if (RATE_LIMIT_STORE.size < 1000) {
    return;
  }

  for (const [key, bucket] of RATE_LIMIT_STORE.entries()) {
    if (bucket.resetAtMs <= nowMs) {
      RATE_LIMIT_STORE.delete(key);
    }
  }
}

function normalizeBackend(rawValue) {
  const normalized = String(rawValue || "auto").trim().toLowerCase();
  if (SUPPORTED_BACKENDS.has(normalized)) {
    return normalized;
  }
  return "auto";
}

function parseSupabaseRateLimitResult(payload) {
  if (Array.isArray(payload)) {
    return payload[0] ?? null;
  }
  return payload ?? null;
}

function warnDistributedFallbackOnce(reason, error) {
  if (DISTRIBUTED_FALLBACK_WARNINGS.has(reason)) {
    return;
  }
  DISTRIBUTED_FALLBACK_WARNINGS.add(reason);
  const errorMessage = error instanceof Error ? error.message : String(error || "unknown error");
  console.warn(`[rate-limit] falling back to in-memory store (${reason}): ${errorMessage}`);
}

function enforceInMemoryRateLimit(
  request,
  { scope, maxRequests, windowMs, keySuffix = "" },
  options = {}
) {
  const nowMs = options.nowMs ?? Date.now();
  const max = Math.max(1, Number.parseInt(String(maxRequests ?? 0), 10) || 1);
  const window = Math.max(1000, Number.parseInt(String(windowMs ?? 0), 10) || 1000);
  const address = getClientAddress(request);
  const bucketKey = `${scope}:${address}:${keySuffix || "-"}`;

  pruneExpiredBuckets(nowMs);

  const existing = RATE_LIMIT_STORE.get(bucketKey);
  if (!existing || existing.resetAtMs <= nowMs) {
    RATE_LIMIT_STORE.set(bucketKey, {
      count: 1,
      resetAtMs: nowMs + window
    });
    return;
  }

  if (existing.count >= max) {
    throw new ApiError(429, "rate_limited", "Too many requests. Please try again shortly.");
  }

  existing.count += 1;
  RATE_LIMIT_STORE.set(bucketKey, existing);
}

async function enforceDistributedRateLimit(
  request,
  { scope, maxRequests, windowMs, keySuffix = "" },
  options = {}
) {
  const max = Math.max(1, Number.parseInt(String(maxRequests ?? 0), 10) || 1);
  const window = Math.max(1000, Number.parseInt(String(windowMs ?? 0), 10) || 1000);
  const address = getClientAddress(request);
  const store = options.store;

  if (store && typeof store.acquire === "function") {
    const result = await store.acquire({
      scope,
      maxRequests: max,
      windowMs: window,
      clientAddress: address,
      keySuffix: keySuffix || "-"
    });
    if (!result?.allowed) {
      throw new ApiError(429, "rate_limited", "Too many requests. Please try again shortly.");
    }
    return;
  }

  const serviceClient = options.serviceClient ?? getServiceSupabaseClient();

  const { data, error } = await serviceClient.rpc("acquire_rate_limit_slot", {
    p_scope: scope,
    p_client_address: address,
    p_key_suffix: keySuffix || "-",
    p_max_requests: max,
    p_window_ms: window
  });

  if (error) {
    throw error;
  }

  const result = parseSupabaseRateLimitResult(data);
  if (!result || typeof result.allowed !== "boolean") {
    throw new Error("Invalid distributed rate-limit response payload.");
  }

  if (!result.allowed) {
    throw new ApiError(429, "rate_limited", "Too many requests. Please try again shortly.");
  }
}

export async function enforceRateLimit(
  request,
  policy,
  options = {}
) {
  const backend = normalizeBackend(options.backend ?? process.env.RATE_LIMIT_BACKEND);

  if (backend === "memory") {
    enforceInMemoryRateLimit(request, policy, options);
    return;
  }

  try {
    await enforceDistributedRateLimit(request, policy, options);
    return;
  } catch (error) {
    // If distributed mode is explicitly required, surface infrastructure failures.
    if (backend === "supabase" && !(error instanceof ApiError)) {
      throw new ApiError(500, "rate_limit_unavailable", "Rate limiting is temporarily unavailable.");
    }

    if (!(error instanceof ApiError)) {
      warnDistributedFallbackOnce("distributed_store_unavailable", error);
      enforceInMemoryRateLimit(request, policy, options);
      return;
    }

    throw error;
  }
}

export function resetRateLimitStore() {
  RATE_LIMIT_STORE.clear();
  DISTRIBUTED_FALLBACK_WARNINGS.clear();
}
