function telemetryDisabled() {
  return String(process.env.NEXT_PUBLIC_STREAM_TELEMETRY_DISABLED || "").trim() === "1";
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

export function getStreamErrorDetails(error) {
  if (!error || typeof error !== "object") {
    return {};
  }

  const details = {};
  if (typeof error.name === "string" && error.name) {
    details.error_name = error.name;
  }
  if (typeof error.code === "string" && error.code) {
    details.error_code = error.code;
  }
  if (Number.isFinite(error.status)) {
    details.error_status = error.status;
  }

  return details;
}

export function logClientStreamTelemetry(level, payload) {
  if (telemetryDisabled()) {
    return;
  }

  const logger = getLogger(level);
  logger(
    "[stream-client]",
    JSON.stringify({
      ...payload,
      at: new Date().toISOString()
    })
  );
}
