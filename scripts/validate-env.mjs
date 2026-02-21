import fs from "node:fs";
import path from "node:path";
import { getTutorConfig, resetTutorConfigCache } from "../src/server/config.js";
import {
  getGoogleSpeechConfig,
  resetGoogleSpeechConfigCache
} from "../src/server/google-speech-config.js";
import {
  assertCoppaSchemaReady,
  shouldRunCoppaStartupSchemaCheck
} from "../src/server/session-foundation/coppa-schema-health.js";
import { getSupabaseConfig, resetSupabaseConfigCache } from "../src/server/supabase-config.js";
import { getServiceSupabaseClient, resetSupabaseClientCache } from "../src/server/supabase-clients.js";

function normalizeValue(rawValue) {
  const trimmed = rawValue.trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    if (!key || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      continue;
    }

    const value = normalizeValue(trimmed.slice(separator + 1));
    if (!(key in process.env) || process.env[key] === "") {
      process.env[key] = value;
    }
  }
}

function loadDotEnvFiles() {
  if (process.env.DISABLE_DOTENV_LOAD === "1") {
    return;
  }
  const root = process.cwd();
  loadEnvFile(path.join(root, ".env"));
  loadEnvFile(path.join(root, ".env.local"));
}

async function main() {
  loadDotEnvFiles();
  resetTutorConfigCache();
  resetSupabaseConfigCache();
  resetGoogleSpeechConfigCache();
  resetSupabaseClientCache();

  const config = getTutorConfig(process.env);
  const supabase = getSupabaseConfig(process.env);
  const shouldValidateGoogleSpeech =
    Boolean(process.env.GOOGLE_CLOUD_PROJECT_ID) || Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const speechConfig = shouldValidateGoogleSpeech ? getGoogleSpeechConfig(process.env) : null;
  const shouldCheckCoppaSchema = shouldRunCoppaStartupSchemaCheck(process.env);

  if (shouldCheckCoppaSchema) {
    const serviceClient = getServiceSupabaseClient();
    await assertCoppaSchemaReady({ serviceClient });
  }

  const supabaseHost = new URL(supabase.url).host;
  console.log(
    `Tutor environment valid. Model=${config.model}, PromptVersion=${config.promptVersion}, SupabaseHost=${supabaseHost}, Speech=${speechConfig ? "configured" : "disabled"}, CoppaSchema=${shouldCheckCoppaSchema ? "checked" : "skipped"}`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Environment validation failed");
  process.exit(1);
});
