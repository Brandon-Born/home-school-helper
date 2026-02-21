import { createHash } from "node:crypto";
import { ApiError } from "./api-error.js";

const DEFAULT_MAX_CONNECTIONS_PER_KEY = 3;
const DEFAULT_MAX_CONNECTIONS_PER_SESSION = 12;
const ACTIVE_CONNECTIONS_BY_KEY = new Map();
const ACTIVE_CONNECTIONS_BY_SESSION = new Map();

function parseBoundedInt(rawValue, fallbackValue, min, max) {
  const parsed = Number.parseInt(String(rawValue ?? ""), 10);
  if (!Number.isInteger(parsed)) {
    return fallbackValue;
  }

  return Math.min(max, Math.max(min, parsed));
}

function getStreamConnectionLimits(env = process.env) {
  return {
    maxPerKey: parseBoundedInt(
      env.STREAM_MAX_CONCURRENT_CONNECTIONS,
      DEFAULT_MAX_CONNECTIONS_PER_KEY,
      1,
      20
    ),
    maxPerSession: parseBoundedInt(
      env.STREAM_MAX_CONCURRENT_PER_SESSION,
      DEFAULT_MAX_CONNECTIONS_PER_SESSION,
      2,
      200
    )
  };
}

function getBearerTokenFingerprint(request) {
  const header = String(request.headers.get("authorization") || "");
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token?.trim()) {
    return "anonymous";
  }

  return createHash("sha256").update(token.trim()).digest("hex").slice(0, 16);
}

export function buildStreamConnectionKey({ sessionId, clientAddress, tokenFingerprint }) {
  return `${sessionId}:${clientAddress || "unknown"}:${tokenFingerprint || "anonymous"}`;
}

export function acquireStreamConnectionSlot({ request, sessionId, clientAddress, env = process.env }) {
  const limits = getStreamConnectionLimits(env);
  const tokenFingerprint = getBearerTokenFingerprint(request);
  const key = buildStreamConnectionKey({
    sessionId,
    clientAddress,
    tokenFingerprint
  });

  const currentByKey = ACTIVE_CONNECTIONS_BY_KEY.get(key) ?? 0;
  if (currentByKey >= limits.maxPerKey) {
    throw new ApiError(
      429,
      "stream_too_many_connections",
      "Too many active stream connections. Please close another stream and try again."
    );
  }

  const currentBySession = ACTIVE_CONNECTIONS_BY_SESSION.get(sessionId) ?? 0;
  if (currentBySession >= limits.maxPerSession) {
    throw new ApiError(429, "stream_session_capacity_reached", "Session stream capacity reached. Please try again.");
  }

  ACTIVE_CONNECTIONS_BY_KEY.set(key, currentByKey + 1);
  ACTIVE_CONNECTIONS_BY_SESSION.set(sessionId, currentBySession + 1);

  let released = false;
  const release = () => {
    if (released) {
      return {
        keyCount: ACTIVE_CONNECTIONS_BY_KEY.get(key) ?? 0,
        sessionCount: ACTIVE_CONNECTIONS_BY_SESSION.get(sessionId) ?? 0
      };
    }

    released = true;
    const nextKeyCount = Math.max(0, (ACTIVE_CONNECTIONS_BY_KEY.get(key) ?? 1) - 1);
    if (nextKeyCount <= 0) {
      ACTIVE_CONNECTIONS_BY_KEY.delete(key);
    } else {
      ACTIVE_CONNECTIONS_BY_KEY.set(key, nextKeyCount);
    }

    const nextSessionCount = Math.max(0, (ACTIVE_CONNECTIONS_BY_SESSION.get(sessionId) ?? 1) - 1);
    if (nextSessionCount <= 0) {
      ACTIVE_CONNECTIONS_BY_SESSION.delete(sessionId);
    } else {
      ACTIVE_CONNECTIONS_BY_SESSION.set(sessionId, nextSessionCount);
    }

    return {
      keyCount: nextKeyCount,
      sessionCount: nextSessionCount
    };
  };

  return {
    key,
    tokenFingerprint,
    keyCount: currentByKey + 1,
    sessionCount: currentBySession + 1,
    release
  };
}

export function resetStreamConnectionSlots() {
  ACTIVE_CONNECTIONS_BY_KEY.clear();
  ACTIVE_CONNECTIONS_BY_SESSION.clear();
}
