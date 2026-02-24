import fs from "node:fs";
import { expect } from "@playwright/test";

export function createUniqueChildName(prefix = "PWChild") {
  const stamp = Date.now().toString(36);
  const nonce = Math.random().toString(36).slice(2, 6);
  return `${prefix}-${stamp}-${nonce}`;
}

function resolveBaseOrigin(page) {
  return new URL(page.url()).origin;
}

function readSecretFromEnvFiles() {
  for (const filePath of [".env", ".env.local"]) {
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }
      const separator = trimmed.indexOf("=");
      if (separator < 0) {
        continue;
      }
      const key = trimmed.slice(0, separator).trim();
      if (key !== "PLAYWRIGHT_TEST_AUTH_SECRET") {
        continue;
      }
      return trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    }
  }

  return "";
}

async function readParentAccessToken(page) {
  return page.evaluate(() => {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key || !key.includes("-auth-token")) {
        continue;
      }

      try {
        const payload = JSON.parse(window.localStorage.getItem(key) || "{}");
        const token = String(payload?.access_token || "").trim();
        if (token) {
          return token;
        }
      } catch {
        // Ignore malformed localStorage entries and continue scanning.
      }
    }

    return "";
  });
}

async function seedBillingBackedConsentForPlaywright(page) {
  const secret =
    String(process.env.PLAYWRIGHT_TEST_AUTH_SECRET || "").trim() || readSecretFromEnvFiles();
  if (!secret) {
    throw new Error("PLAYWRIGHT_TEST_AUTH_SECRET is required to seed billing-backed consent in Playwright.");
  }

  const parentAccessToken = await readParentAccessToken(page);
  if (!parentAccessToken) {
    throw new Error("Unable to read parent auth token from localStorage for Playwright billing seed.");
  }

  const response = await page.request.post(`${resolveBaseOrigin(page)}/api/test-auth/seed-parent-billing`, {
    headers: {
      "x-test-auth-secret": secret,
      Authorization: `Bearer ${parentAccessToken}`
    }
  });

  expect(response.status()).toBe(200);
}

export async function goToParentSection(page, sectionId) {
  const normalizedSection = String(sectionId || "").trim().toLowerCase();
  const sectionButton = page.getByTestId(`parent-section-link-${normalizedSection}`);
  await expect(sectionButton).toBeVisible({ timeout: 30000 });
  await sectionButton.click();
  await expect(sectionButton).toHaveAttribute("aria-current", "page", { timeout: 30000 });
}

export async function openParentConsole(page, { section = "children" } = {}) {
  await page.goto("/parent", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Signed in as")).toBeVisible({ timeout: 30000 });
  await expect(page.getByTestId("parent-section-link-children")).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole("heading", { name: "Your children" })).toBeVisible({ timeout: 30000 });
  await ensureCoppaConsentGranted(page);
  await goToParentSection(page, section);
}

export async function ensureCoppaConsentGranted(page) {
  const addChildButton = page.getByTestId("child-add-button");
  const grantButton = page.getByRole("button", {
    name: /I am the parent or legal guardian|Verify parent payment method|Start free week/i
  });

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    await goToParentSection(page, "children");
    // If the add button is visible and enabled, or the form is already open (expanded), we have consent.
    if ((await addChildButton.count()) > 0) {
      if (await addChildButton.isEnabled()) return;
      // If there's an active request running it could be disabled briefly, so check if we already have the form open
      if (await page.locator('#child-create-form').isVisible()) return;
    } else if (await page.locator('#child-create-form').isVisible()) {
      return; // form is already rendering, which implies consent
    }

    await goToParentSection(page, "managed");
    if ((await grantButton.count()) > 0 && (await grantButton.isVisible())) {
      const buttonLabel = ((await grantButton.textContent()) || "").trim().toLowerCase();
      const isBillingFlowCta = buttonLabel.includes("verify parent payment method") || buttonLabel.includes("start free week");

      if (isBillingFlowCta) {
        await seedBillingBackedConsentForPlaywright(page);
        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(page.getByText("Signed in as")).toBeVisible({ timeout: 30000 });
        continue;
      }

      const consentResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes("/api/privacy/consent") &&
          response.request().method() === "POST"
      );
      await grantButton.click();
      const consentResponse = await consentResponsePromise;
      expect(consentResponse.status()).toBe(200);
      await expect(page.getByRole("button", { name: "Revoke consent" })).toBeVisible({
        timeout: 30000
      });
      await goToParentSection(page, "children");
      await expect(addChildButton).toBeEnabled({ timeout: 30000 });
      return;
    }

    await page.waitForTimeout(250);
  }

  throw new Error("Timed out waiting for parental consent to allow child profile creation.");
}

export async function createChildProfile(
  page,
  {
    childName,
    age = "10",
    grade = "5",
    subjects = "Math, Reading",
    personality = "Learns best with short steps."
  }
) {
  await goToParentSection(page, "children");

  const createChildResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/children") && response.request().method() === "POST"
  );

  const addButton = page.getByTestId("child-add-button");
  if ((await addButton.count()) > 0 && await addButton.isVisible()) {
    await addButton.click({ force: true });
  }

  await page.locator('#child-name').fill(childName);
  await page.locator('#child-age').fill(age);
  await page.locator('#child-grade').fill(grade);
  await page.locator('#child-subjects').fill(subjects);
  await page.locator('#child-personality').fill(personality);
  await page.getByRole("button", { name: "Save", exact: true }).click({ force: true });

  const createChildResponse = await createChildResponsePromise;
  expect(createChildResponse.status()).toBe(201);
  const createChildPayload = await createChildResponse.json();
  const childId = createChildPayload?.child?.id;
  expect(childId).toBeTruthy();

  const childCard = page.getByTestId(`child-card-${childId}`);
  await expect(childCard).toBeVisible({ timeout: 30000 });
  await childCard.click();

  return { childId, childCard };
}

export async function startSessionForChild(
  page,
  {
    childName,
    dailySubject = "Math",
    parentContext = "Ask guiding questions first."
  }
) {
  await goToParentSection(page, "sessions");

  // Select the child in the child-picker (no child is pre-selected on sessions tab)
  const childCard = page.getByRole("button", { name: new RegExp(childName, "i") });
  await expect(childCard).toBeVisible({ timeout: 30000 });
  await childCard.click();

  // Wait for session form to appear
  await expect(page.getByLabel("Today's subject")).toBeVisible({ timeout: 30000 });

  const startSessionResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/session/start") && response.request().method() === "POST"
  );

  await page.getByLabel("Today's subject").fill(dailySubject);
  await page.getByLabel("Notes for the tutor (private)").fill(parentContext);
  await page.getByTestId("session-start-submit").click();

  const startSessionResponse = await startSessionResponsePromise;
  expect(startSessionResponse.status()).toBe(201);
  const startSessionPayload = await startSessionResponse.json();
  const session = startSessionPayload?.session ?? {};
  const sessionId = session.session_id;
  expect(sessionId).toBeTruthy();

  const sharePanel = page.getByTestId("session-share-panel");
  await expect(sharePanel).toBeVisible({ timeout: 30000 });
  const joinCodeEl = page.getByTestId(`active-session-code-${sessionId}`);
  await expect(joinCodeEl).toBeVisible({ timeout: 30000 });

  const joinCode = (await joinCodeEl.innerText()).trim();
  expect(joinCode).toMatch(/^[A-Z0-9]{8}$/);

  const activeCard = page.getByTestId(`active-session-card-${sessionId}`);
  await expect(activeCard).toBeVisible({ timeout: 30000 });
  await expect(page.getByTestId(`active-session-code-${sessionId}`)).toHaveText(joinCode, { timeout: 30000 });

  return { joinCode, sharePanel, activeCard, sessionId };
}

export async function regenerateCodeFromActiveCard(page, { sessionId, previousCode }) {
  await goToParentSection(page, "sessions");

  // Click the session card to select the child context in Sessions view.
  const sessionCard = page.getByTestId(`active-session-card-${sessionId}`);
  await expect(sessionCard).toBeVisible({ timeout: 30000 });
  await sessionCard.click();

  const regenerateResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/session/${sessionId}/manage`) &&
      response.request().method() === "POST"
  );

  const cardCode = page.getByTestId(`active-session-code-${sessionId}`);
  await expect(cardCode).toBeVisible({ timeout: 30000 });
  await page.getByTestId(`active-session-regenerate-${sessionId}`).click();

  const regenerateResponse = await regenerateResponsePromise;
  expect(regenerateResponse.status()).toBe(200);
  const regeneratePayload = await regenerateResponse.json();
  const payloadCode = String(regeneratePayload?.join_code || "").trim();
  expect(payloadCode).toMatch(/^[A-Z0-9]{8}$/);
  expect(payloadCode).not.toBe(previousCode);

  await expect(cardCode).toHaveText(payloadCode, { timeout: 30000 });

  return payloadCode;
}

export async function rejoinSessionFromActiveCard(page, { sessionId, expectedCode }) {
  await goToParentSection(page, "sessions");
  await page.getByTestId(`active-session-card-${sessionId}`).click();

  await expect(page.getByTestId(`active-session-code-${sessionId}`)).toHaveText(expectedCode, {
    timeout: 30000
  });
}

export async function endSessionFromActiveCard(page, { sessionId }) {
  await goToParentSection(page, "sessions");
  const activeCard = page.getByTestId(`active-session-card-${sessionId}`);
  if ((await activeCard.count()) === 0) {
    return;
  }

  const endResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/session/${sessionId}/manage`) &&
      response.request().method() === "POST"
  );

  await page.getByTestId(`active-session-end-${sessionId}`).click();
  await page.getByTestId(`active-session-end-confirm-${sessionId}`).click();

  const endResponse = await endResponsePromise;
  expect(endResponse.status()).toBe(200);

  await expect(page.getByTestId(`active-session-card-${sessionId}`)).toHaveCount(0, {
    timeout: 30000
  });
}

async function listChildren(page) {
  const response = await page.request.get(`${resolveBaseOrigin(page)}/api/children`);
  if (!response.ok()) {
    return [];
  }
  const payload = await response.json();
  return Array.isArray(payload?.children) ? payload.children : [];
}

async function listActiveSessions(page) {
  const response = await page.request.get(`${resolveBaseOrigin(page)}/api/session/active`);
  if (!response.ok()) {
    return [];
  }
  const payload = await response.json();
  return Array.isArray(payload?.sessions) ? payload.sessions : [];
}

async function endSessionById(page, sessionId) {
  const response = await page.request.post(
    `${resolveBaseOrigin(page)}/api/session/${sessionId}/manage`,
    {
      data: { action: "end" }
    }
  );
  return response.ok() || response.status() === 404;
}

async function deleteChildById(page, childId) {
  const response = await page.request.delete(`${resolveBaseOrigin(page)}/api/children/${childId}`);
  return response.ok() || response.status() === 404;
}

export async function cleanupFixtureData(page, { childId = null, childName = null, sessionId = null } = {}) {
  if (page.isClosed()) {
    return;
  }

  const targetSessionIds = new Set();
  const targetChildIds = new Set();

  if (sessionId) {
    targetSessionIds.add(sessionId);
  }
  if (childId) {
    targetChildIds.add(childId);
  }

  const activeSessions = await listActiveSessions(page);
  for (const session of activeSessions) {
    if (
      (sessionId && session.session_id === sessionId) ||
      (childId && session.child_id === childId) ||
      (childName && session.child_name === childName)
    ) {
      targetSessionIds.add(session.session_id);
      targetChildIds.add(session.child_id);
    }
  }

  for (const targetSessionId of targetSessionIds) {
    await endSessionById(page, targetSessionId);
  }

  const children = await listChildren(page);
  for (const child of children) {
    if ((childId && child.id === childId) || (childName && child.first_name === childName)) {
      targetChildIds.add(child.id);
    }
  }

  for (const targetChildId of targetChildIds) {
    await deleteChildById(page, targetChildId);
  }
}
