import { expect } from "@playwright/test";

export function createUniqueChildName(prefix = "PWChild") {
  const stamp = Date.now().toString(36);
  const nonce = Math.random().toString(36).slice(2, 6);
  return `${prefix}-${stamp}-${nonce}`;
}

function resolveBaseOrigin(page) {
  return new URL(page.url()).origin;
}

export async function openParentConsole(page) {
  await page.goto("/parent", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Signed in as")).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole("heading", { name: "Your children" })).toBeVisible({ timeout: 30000 });
  await ensureCoppaConsentGranted(page);
}

export async function ensureCoppaConsentGranted(page) {
  const addChildButton = page.getByTestId("child-add-button");
  const grantButton = page.getByRole("button", { name: "I am the parent or legal guardian" });

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if ((await addChildButton.count()) > 0 && (await addChildButton.isEnabled())) {
      return;
    }

    if ((await grantButton.count()) > 0 && (await grantButton.isVisible())) {
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
  const createChildResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/children") && response.request().method() === "POST"
  );

  await page.getByTestId("child-add-button").click();
  await page.getByLabel("First name").fill(childName);
  await page.getByLabel("Age").fill(age);
  await page.getByLabel("Grade").fill(grade);
  await page.getByLabel("Subjects").fill(subjects);
  await page.getByLabel("How they learn best").fill(personality);
  await page.getByRole("button", { name: "Save" }).click();

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

  const lessonCard = page.getByTestId("session-lesson-share-panel");
  await expect(lessonCard).toBeVisible({ timeout: 30000 });
  const lessonCode = page.getByTestId("session-lesson-join-code");
  await expect(lessonCode).toBeVisible({ timeout: 30000 });

  const joinCode = (await lessonCode.innerText()).trim();
  expect(joinCode).toMatch(/^[A-Z0-9]{8}$/);

  const activeCard = page.getByTestId(`active-session-card-${sessionId}`);
  await expect(activeCard).toBeVisible({ timeout: 30000 });
  await expect(page.getByTestId(`active-session-code-${sessionId}`)).toHaveText(joinCode, {
    timeout: 30000
  });

  return { joinCode, lessonCard, activeCard, sessionId };
}

export async function regenerateCodeFromActiveCard(page, { sessionId, previousCode }) {
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
  await expect(page.getByTestId("session-lesson-join-code")).toHaveText(payloadCode, { timeout: 30000 });

  return payloadCode;
}

export async function rejoinSessionFromActiveCard(page, { sessionId, expectedCode }) {
  await page.getByTestId(`active-session-rejoin-${sessionId}`).click();

  await expect(page.getByTestId("session-lesson-join-code")).toHaveText(expectedCode, {
    timeout: 30000
  });
}

export async function endSessionFromActiveCard(page, { sessionId }) {
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
