function telemetryDisabled(env = process.env) {
  return String(env.STREAM_TELEMETRY_DISABLED || "").trim() === "1";
}

function includeErrorMessage(env = process.env) {
  return String(env.SERVER_TELEMETRY_INCLUDE_ERROR_MESSAGE || "").trim() === "1";
}

function sanitizeErrorMessage(value) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return "";
  }
  return normalized.slice(0, 160);
}

function getLogger(level) {
  if (level === "error") {
    return console.error;
  }
  if (level === "warn") {
    return console.warn;
  }
  return console.info;
}

export function getServerStreamErrorDetails(error, options = {}) {
  if (!error || typeof error !== "object") {
    return {};
  }

  const env = options.env ?? process.env;
  const details = {};
  if (typeof error.code === "string" && error.code) {
    details.error_code = error.code;
  }
  if (Number.isFinite(error.status)) {
    details.error_status = error.status;
  }
  if (includeErrorMessage(env)) {
    const sanitizedMessage = sanitizeErrorMessage(error.message);
    if (sanitizedMessage) {
      details.error_message = sanitizedMessage;
    }
  }

  return details;
}

export function logServerStreamTelemetry(level, payload, { env = process.env } = {}) {
  if (telemetryDisabled(env)) {
    return;
  }

  const logger = getLogger(level);
  logger(
    "[stream-server]",
    JSON.stringify({
      ...payload,
      at: new Date().toISOString()
    })
  );
}
