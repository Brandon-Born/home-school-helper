function telemetryDisabled(env = process.env) {
  return String(env.SPEECH_TELEMETRY_DISABLED || "").trim() === "1";
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

export function getServerVoiceErrorDetails(error) {
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

export function logServerVoiceTelemetry(level, payload, { env = process.env } = {}) {
  if (telemetryDisabled(env)) {
    return;
  }

  const logger = getLogger(level);
  logger(
    "[voice-server]",
    JSON.stringify({
      ...payload,
      at: new Date().toISOString()
    })
  );
}

export function logServerVoiceMetric(metric, payload = {}, options = {}) {
  logServerVoiceTelemetry(options.level ?? "info", {
    event: "voice_metric",
    metric,
    count: 1,
    ...payload
  }, options);
}
