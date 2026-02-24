import { expect, request as playwrightRequest, test } from "@playwright/test";
import {
  cleanupFixtureData,
  createChildProfile,
  createUniqueChildName,
  ensureCoppaConsentGranted,
  goToParentSection,
  startSessionForChild
} from "./helpers/parent-console.js";

function createUniqueTestEmail() {
  const stamp = Date.now().toString(36);
  const nonce = Math.random().toString(36).slice(2, 8);
  return `playwright-new-${stamp}-${nonce}@example.test`;
}

async function requestBootstrapLink(baseURL, email) {
  const secret = String(process.env.PLAYWRIGHT_TEST_AUTH_SECRET || "").trim();
  if (!secret) {
    throw new Error("PLAYWRIGHT_TEST_AUTH_SECRET is required for new-user-experience e2e.");
  }

  const api = await playwrightRequest.newContext({ baseURL });
  try {
    const response = await api.post("/api/test-auth/bootstrap", {
      headers: {
        "x-test-auth-secret": secret
      },
      data: {
        email
      }
    });

    expect(response.status()).toBe(200);
    const payload = await response.json();
    const actionLink = String(payload?.auth?.action_link || "").trim();
    expect(actionLink).toBeTruthy();
    return actionLink;
  } finally {
    await api.dispose();
  }
}

async function resolveActionLinkTarget(actionLink) {
  let actionUrl;
  try {
    actionUrl = new URL(actionLink);
  } catch {
    return actionLink;
  }

  const isSupabaseVerifyLink =
    actionUrl.hostname.endsWith(".supabase.co") && actionUrl.pathname.startsWith("/auth/v1/verify");
  if (!isSupabaseVerifyLink) {
    return actionUrl.toString();
  }

  try {
    const response = await fetch(actionUrl, { redirect: "manual" });
    const location = response.headers.get("location");
    if (!location) {
      return actionUrl.toString();
    }
    return new URL(location, actionUrl).toString();
  } catch {
    return actionUrl.toString();
  }
}

function resolveBootstrapNavigationLink(actionLink, baseURL) {
  const actionUrl = new URL(actionLink);
  const resolvedBaseUrl = new URL(baseURL);

  if (actionUrl.origin === resolvedBaseUrl.origin) {
    return actionUrl.toString();
  }

  const hashParams = new URLSearchParams(actionUrl.hash.replace(/^#/, ""));
  const hasSessionTokens = Boolean(hashParams.get("access_token") && hashParams.get("refresh_token"));
  const hasAuthCode = Boolean(actionUrl.searchParams.get("code"));
  if (!hasSessionTokens && !hasAuthCode) {
    return actionUrl.toString();
  }

  const rewritten = new URL("/auth/callback", resolvedBaseUrl);
  rewritten.search = actionUrl.search;
  rewritten.hash = actionUrl.hash;
  return rewritten.toString();
}

test("new parent can complete first-time onboarding workflow", async ({ baseURL, browser }) => {
  test.setTimeout(90_000);

  const resolvedBaseUrl = String(baseURL || process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000");
  const email = createUniqueTestEmail();
  const actionLink = await requestBootstrapLink(resolvedBaseUrl, email);
  const resolvedActionLink = await resolveActionLinkTarget(actionLink);
  const bootstrapNavigationLink = resolveBootstrapNavigationLink(resolvedActionLink, resolvedBaseUrl);
  const childName = createUniqueChildName("PWNewUser");
  const fixture = {
    childName,
    childId: null,
    sessionId: null
  };

  const context = await browser.newContext({ baseURL: resolvedBaseUrl });
  const page = await context.newPage();

  try {
    await page.goto(bootstrapNavigationLink, { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/parent(?:[/?#]|$)/, { timeout: 30000 });
    await expect(page.getByText("Signed in as")).toBeVisible({ timeout: 30000 });

    await expect(page.getByTestId("parent-trial-onboarding")).toBeVisible({ timeout: 30000 });
    await expect(
      page.getByTestId("parent-trial-setup-card").getByRole("heading", { name: "Start for $1.99 (first month)" })
    ).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole("button", { name: "Start subscription for $1.99" })).toBeVisible({
      timeout: 30000
    });

    await ensureCoppaConsentGranted(page);
    await goToParentSection(page, "children");
    await expect(page.getByText("No children added yet — add one to get started.")).toBeVisible({
      timeout: 30000
    });
    const created = await createChildProfile(page, { childName, subjects: "Math, Reading" });
    fixture.childId = created.childId;

    const started = await startSessionForChild(page, {
      childName,
      dailySubject: "Math",
      parentContext: "Start with one guiding question."
    });
    fixture.sessionId = started.sessionId;
    expect(started.joinCode).toMatch(/^[A-Z0-9]{8}$/);
    await expect(page.getByTestId("session-share-panel")).toBeVisible({ timeout: 30000 });
  } finally {
    await cleanupFixtureData(page, fixture).catch(() => { });
    await context.close().catch(() => { });
  }
});
