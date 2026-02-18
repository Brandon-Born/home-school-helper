import fs from "node:fs/promises";
import path from "node:path";
import { chromium, request as playwrightRequest } from "@playwright/test";

const AUTH_STATE_PATH = path.resolve("tests/playwright/.auth/parent.json");

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
