function telemetryDisabled() {
  return String(process.env.NEXT_PUBLIC_VOICE_TELEMETRY_DISABLED || "").trim() === "1";
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

export function getVoiceErrorDetails(error) {
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
  if (typeof error.message === "string" && error.message) {
    details.error_message = error.message;
  }

  return details;
}

export function logClientVoiceTelemetry(level, payload) {
  if (telemetryDisabled()) {
    return;
  }

  const logger = getLogger(level);
  logger(
    "[voice-client]",
    JSON.stringify({
      ...payload,
      at: new Date().toISOString()
    })
  );
}

export function logClientVoiceMetric(metric, payload = {}, { level = "info" } = {}) {
  logClientVoiceTelemetry(level, {
    event: "voice_metric",
    metric,
    count: 1,
    ...payload
  });
}
