import { ApiError } from "./api-error.js";

const ALLOWED_EVENTS = new Set([
  "session_start",
  "child_join",
  "turn_send",
  "nudge_send",
  "voice_usage"
]);

const STATUS_BY_EVENT = Object.freeze({
  session_start: new Set(["success", "failed"]),
  child_join: new Set(["success", "failed"]),
  turn_send: new Set(["success", "failed"]),
  nudge_send: new Set(["success", "failed"]),
  voice_usage: new Set(["started", "transcribed", "failed", "permission_denied"])
});

const VOICE_TRANSPORTS = new Set(["cloud_stt", "browser_stt"]);

function normalizeStringEnum(value, allowed, fallback = null) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }
  if (!allowed.has(normalized)) {
    return fallback;
  }
  return normalized;
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }
  return fallback;
}

function normalizeInt(value, { min = 0, max = 999 } = {}) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) {
    return min;
  }
  return Math.min(max, Math.max(min, parsed));
}

function buildSanitizedPayload(event, rawPayload = {}) {
  const status = normalizeStringEnum(rawPayload.status, STATUS_BY_EVENT[event]);
  if (!status) {
    throw new ApiError(400, "validation_error", `status is required for analytics event '${event}'.`);
  }

  if (event === "session_start") {
    return {
      status,
      subject_count: normalizeInt(rawPayload.subject_count, { min: 0, max: 20 }),
      has_parent_context: normalizeBoolean(rawPayload.has_parent_context)
    };
  }

  if (event === "voice_usage") {
    const transport = normalizeStringEnum(rawPayload.transport, VOICE_TRANSPORTS);
    return {
      status,
      transport: transport || "unknown"
    };
  }

  return { status };
}

export function normalizeProductAnalyticsEvent(raw = {}) {
  const event = normalizeStringEnum(raw.event, ALLOWED_EVENTS);
  if (!event) {
    throw new ApiError(400, "validation_error", "event must be one of: session_start, child_join, turn_send, nudge_send, voice_usage.");
  }

  const payload = buildSanitizedPayload(event, raw.payload);
  return { event, payload };
}

function analyticsDisabled(env = process.env) {
  return String(env.PRODUCT_ANALYTICS_DISABLED || "").trim() === "1";
}

export function logProductAnalyticsEvent(event, payload, { env = process.env } = {}) {
  if (analyticsDisabled(env)) {
    return;
  }

  console.info(
    "[product-analytics]",
    JSON.stringify({
      event,
      payload,
      at: new Date().toISOString()
    })
  );
}
