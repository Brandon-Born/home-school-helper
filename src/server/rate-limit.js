import { ApiError } from "./api-error.js";

const RATE_LIMIT_STORE = new Map();

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

export function enforceRateLimit(
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

export function resetRateLimitStore() {
  RATE_LIMIT_STORE.clear();
}
