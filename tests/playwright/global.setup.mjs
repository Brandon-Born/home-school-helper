import fs from "node:fs/promises";
import path from "node:path";
import { chromium, request as playwrightRequest } from "@playwright/test";

const AUTH_STATE_PATH = path.resolve("tests/playwright/.auth/parent.json");

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

async function loadEnvFile(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");
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

      if (process.env[key] && String(process.env[key]).trim()) {
        continue;
      }

      const value = normalizeValue(trimmed.slice(separator + 1));
      process.env[key] = value;
    }
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return;
    }

    throw error;
  }
}

async function loadDotEnvFiles() {
  await loadEnvFile(path.resolve(".env"));
  await loadEnvFile(path.resolve(".env.local"));
}

function requireEnv(name) {
  const value = String(process.env[name] ?? "").trim();
  if (!value) {
    throw new Error(`Missing required env var for Playwright auth bootstrap: ${name}`);
  }
  return value;
}

function resolveBaseUrl(config) {
  const configuredBaseUrl = config.projects[0]?.use?.baseURL;
  if (configuredBaseUrl) {
    return String(configuredBaseUrl);
  }
  return process.env.PLAYWRIGHT_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
}

async function fetchBootstrapLink(baseURL, secret) {
  const api = await playwrightRequest.newContext({ baseURL });
  try {
    const response = await api.post("/api/test-auth/bootstrap", {
      headers: {
        "x-test-auth-secret": secret
      }
    });

    if (!response.ok()) {
      const payloadText = await response.text();
      throw new Error(
        `Auth bootstrap request failed (${response.status()}): ${payloadText || "empty response"}`
      );
    }

    const payload = await response.json();
    const actionLink = payload?.auth?.action_link;
    if (!actionLink) {
      throw new Error("Auth bootstrap response did not include auth.action_link.");
    }
    return String(actionLink);
  } finally {
    await api.dispose();
  }
}

export default async function globalSetup(config) {
  await loadDotEnvFiles();

  const secret = requireEnv("PLAYWRIGHT_TEST_AUTH_SECRET");
  const baseURL = resolveBaseUrl(config);
  const actionLink = await fetchBootstrapLink(baseURL, secret);

  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();

  try {
    await page.goto(actionLink, { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/parent(?:[/?#]|$)/, { timeout: 30000 });

    await fs.mkdir(path.dirname(AUTH_STATE_PATH), { recursive: true });
    await context.storageState({ path: AUTH_STATE_PATH });
  } finally {
    await browser.close();
  }
}
