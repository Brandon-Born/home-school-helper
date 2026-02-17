import { ApiError } from "./api-error.js";

const REQUIRED_KEYS = ["GOOGLE_CLOUD_PROJECT_ID", "GOOGLE_SERVICE_ACCOUNT_JSON"];

const DEFAULTS = {
  GOOGLE_CLOUD_LOCATION: "global",
  GOOGLE_STT_RECOGNIZER: "_",
  GOOGLE_STT_LANGUAGE_CODE: "en-US",
  GOOGLE_STT_MODEL: "latest_short",
  GOOGLE_TTS_LANGUAGE_CODE: "en-US",
  GOOGLE_TTS_VOICE_NAME: "en-US-Chirp3-HD-Achernar",
  GOOGLE_TTS_AUDIO_ENCODING: "MP3",
  GOOGLE_TTS_SPEAKING_RATE: "0.92"
};

let cachedConfig;

function parseFloatValue(name, rawValue, min, max) {
  const value = Number.parseFloat(String(rawValue));
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new ApiError(500, "speech_provider_config_invalid", `${name} must be between ${min} and ${max}.`);
  }

  return value;
}

function parseServiceAccount(rawValue) {
  try {
    const normalizedValue = String(rawValue || "").trim();
    const unwrappedValue =
      (normalizedValue.startsWith("\"") && normalizedValue.endsWith("\"")) ||
      (normalizedValue.startsWith("'") && normalizedValue.endsWith("'"))
        ? normalizedValue.slice(1, -1)
        : normalizedValue;
    const parsed = JSON.parse(unwrappedValue);
    if (!parsed.client_email || !parsed.private_key) {
      throw new Error("Missing client_email or private_key.");
    }

    return {
      clientEmail: String(parsed.client_email),
      privateKey: String(parsed.private_key).replace(/\\n/g, "\n")
    };
  } catch {
    throw new ApiError(
      500,
      "speech_provider_config_invalid",
      "GOOGLE_SERVICE_ACCOUNT_JSON must be valid service account JSON."
    );
  }
}

export function getGoogleSpeechConfig(env = process.env) {
  if (env === process.env && cachedConfig) {
    return cachedConfig;
  }

  const missing = REQUIRED_KEYS.filter((key) => !env[key] || !String(env[key]).trim());
  if (missing.length > 0) {
    throw new ApiError(
      503,
      "speech_provider_not_configured",
      `Missing Google Speech environment variables: ${missing.join(", ")}`
    );
  }

  const account = parseServiceAccount(env.GOOGLE_SERVICE_ACCOUNT_JSON);

  const config = {
    projectId: String(env.GOOGLE_CLOUD_PROJECT_ID),
    location: String(env.GOOGLE_CLOUD_LOCATION ?? DEFAULTS.GOOGLE_CLOUD_LOCATION),
    sttRecognizer: String(env.GOOGLE_STT_RECOGNIZER ?? DEFAULTS.GOOGLE_STT_RECOGNIZER),
    sttLanguageCode: String(env.GOOGLE_STT_LANGUAGE_CODE ?? DEFAULTS.GOOGLE_STT_LANGUAGE_CODE),
    sttModel: String(env.GOOGLE_STT_MODEL ?? DEFAULTS.GOOGLE_STT_MODEL),
    ttsLanguageCode: String(env.GOOGLE_TTS_LANGUAGE_CODE ?? DEFAULTS.GOOGLE_TTS_LANGUAGE_CODE),
    ttsVoiceName: String(env.GOOGLE_TTS_VOICE_NAME ?? DEFAULTS.GOOGLE_TTS_VOICE_NAME),
    ttsAudioEncoding: String(env.GOOGLE_TTS_AUDIO_ENCODING ?? DEFAULTS.GOOGLE_TTS_AUDIO_ENCODING),
    ttsSpeakingRate: parseFloatValue(
      "GOOGLE_TTS_SPEAKING_RATE",
      env.GOOGLE_TTS_SPEAKING_RATE ?? DEFAULTS.GOOGLE_TTS_SPEAKING_RATE,
      0.25,
      2
    ),
    clientEmail: account.clientEmail,
    privateKey: account.privateKey
  };

  if (env === process.env) {
    cachedConfig = config;
  }

  return config;
}

export function resetGoogleSpeechConfigCache() {
  cachedConfig = undefined;
}
