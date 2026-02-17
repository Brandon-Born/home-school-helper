const REQUIRED_ENV_KEYS = ["ANTHROPIC_API_KEY", "ANTHROPIC_MODEL"];

const DEFAULTS = {
  ANTHROPIC_MAX_TOKENS: "512",
  ANTHROPIC_TEMPERATURE: "0.3",
  TUTOR_SYSTEM_PROMPT_VERSION: "v1"
};

let cachedConfig;

function parseInteger(name, raw, min) {
  const value = Number.parseInt(raw, 10);
  if (Number.isNaN(value) || value < min) {
    throw new Error(`${name} must be an integer >= ${min}. Received: ${raw}`);
  }
  return value;
}

function parseFloatValue(name, raw, min, max) {
  const value = Number.parseFloat(raw);
  if (Number.isNaN(value) || value < min || value > max) {
    throw new Error(`${name} must be between ${min} and ${max}. Received: ${raw}`);
  }
  return value;
}

export function getTutorConfig(env = process.env) {
  if (env === process.env && cachedConfig) {
    return cachedConfig;
  }

  const missing = REQUIRED_ENV_KEYS.filter((key) => !env[key] || !String(env[key]).trim());
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  const maxTokensRaw = env.ANTHROPIC_MAX_TOKENS ?? DEFAULTS.ANTHROPIC_MAX_TOKENS;
  const temperatureRaw = env.ANTHROPIC_TEMPERATURE ?? DEFAULTS.ANTHROPIC_TEMPERATURE;
  const promptVersionRaw = env.TUTOR_SYSTEM_PROMPT_VERSION ?? DEFAULTS.TUTOR_SYSTEM_PROMPT_VERSION;

  const config = {
    apiKey: String(env.ANTHROPIC_API_KEY),
    model: String(env.ANTHROPIC_MODEL),
    maxTokens: parseInteger("ANTHROPIC_MAX_TOKENS", String(maxTokensRaw), 1),
    temperature: parseFloatValue("ANTHROPIC_TEMPERATURE", String(temperatureRaw), 0, 1),
    promptVersion: String(promptVersionRaw)
  };

  if (env === process.env) {
    cachedConfig = config;
  }

  return config;
}

export function resetTutorConfigCache() {
  cachedConfig = undefined;
}
