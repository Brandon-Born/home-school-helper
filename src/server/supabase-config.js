const REQUIRED_SUPABASE_ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY"
];

let cachedConfig;

function assertValidUrl(rawUrl) {
  try {
    new URL(rawUrl);
  } catch {
    throw new Error(`NEXT_PUBLIC_SUPABASE_URL is not a valid URL: ${rawUrl}`);
  }
}

export function getSupabaseConfig(env = process.env) {
  if (env === process.env && cachedConfig) {
    return cachedConfig;
  }

  const missing = REQUIRED_SUPABASE_ENV_KEYS.filter((key) => !env[key] || !String(env[key]).trim());
  if (missing.length > 0) {
    throw new Error(`Missing required Supabase environment variables: ${missing.join(", ")}`);
  }

  const config = {
    url: String(env.NEXT_PUBLIC_SUPABASE_URL),
    anonKey: String(env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    serviceRoleKey: String(env.SUPABASE_SERVICE_ROLE_KEY)
  };

  assertValidUrl(config.url);

  if (env === process.env) {
    cachedConfig = config;
  }

  return config;
}

export function resetSupabaseConfigCache() {
  cachedConfig = undefined;
}
