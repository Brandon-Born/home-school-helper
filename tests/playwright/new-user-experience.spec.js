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

test("new parent can complete first-time onboarding workflow", async ({ baseURL, browser }) => {
  test.setTimeout(90_000);

  const resolvedBaseUrl = String(baseURL || process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000");
  const email = createUniqueTestEmail();
  const actionLink = await requestBootstrapLink(resolvedBaseUrl, email);
  const childName = createUniqueChildName("PWNewUser");
  const fixture = {
    childName,
    childId: null,
    sessionId: null
  };

  const context = await browser.newContext({ baseURL: resolvedBaseUrl });
  const page = await context.newPage();

  try {
    await page.goto(actionLink, { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/parent(?:[/?#]|$)/, { timeout: 30000 });
    await expect(page.getByText("Signed in as")).toBeVisible({ timeout: 30000 });

    await goToParentSection(page, "children");
    await expect(page.getByText("No children added yet — add one to get started.")).toBeVisible({
      timeout: 30000
    });
    await expect(page.getByTestId("child-add-button")).toBeDisabled({ timeout: 30000 });

    await ensureCoppaConsentGranted(page);
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
