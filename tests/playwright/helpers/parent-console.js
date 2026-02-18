import { expect } from "@playwright/test";

export function createUniqueChildName(prefix = "PWChild") {
  const stamp = Date.now().toString(36);
  const nonce = Math.random().toString(36).slice(2, 6);
  return `${prefix}-${stamp}-${nonce}`;
}

export async function openParentConsole(page) {
  await page.goto("/parent", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Signed in as")).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole("heading", { name: "Your children" })).toBeVisible({ timeout: 30000 });
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
  await page.getByRole("button", { name: /Add a child/i }).click();
  await page.getByLabel("First name").fill(childName);
  await page.getByLabel("Age").fill(age);
  await page.getByLabel("Grade").fill(grade);
  await page.getByLabel("Subjects").fill(subjects);
  await page.getByLabel("How they learn best").fill(personality);
  await page.getByRole("button", { name: "Save" }).click();

  const childCard = page.locator(".child-card").filter({ hasText: childName }).first();
  await expect(childCard).toBeVisible({ timeout: 30000 });
  await childCard.click();
  return childCard;
}

export async function startSessionForChild(
  page,
  {
    childName,
    dailySubject = "Math",
    parentContext = "Ask guiding questions first."
  }
) {
  await page.getByLabel("Today's subject").fill(dailySubject);
  await page.getByLabel("Notes for the tutor (private)").fill(parentContext);
  await page.getByRole("button", { name: /Create join code/i }).click();

  const lessonCard = page
    .locator(".card.card--accent")
    .filter({ hasText: `Share this code with ${childName}:` })
    .first();
  await expect(lessonCard).toBeVisible({ timeout: 30000 });

  const lessonCode = lessonCard.locator(".join-code").first();
  await expect(lessonCode).toBeVisible({ timeout: 30000 });
  const joinCode = (await lessonCode.innerText()).trim();
  expect(joinCode).toMatch(/^[A-Z0-9]{8}$/);

  const activeCard = page.locator(".active-session-card").filter({ hasText: childName }).first();
  await expect(activeCard).toBeVisible({ timeout: 30000 });
  await expect(activeCard.locator(".join-code").first()).toHaveText(joinCode, { timeout: 30000 });

  return { joinCode, lessonCard, activeCard };
}

export async function regenerateCodeFromActiveCard(page, { childName, previousCode }) {
  const activeCard = page.locator(".active-session-card").filter({ hasText: childName }).first();
  await expect(activeCard).toBeVisible({ timeout: 30000 });

  const cardCode = activeCard.locator(".join-code").first();
  await expect(cardCode).toBeVisible({ timeout: 30000 });
  await activeCard.getByRole("button", { name: /New code/i }).click();

  await expect
    .poll(
      async () => {
        const nextCode = (await cardCode.innerText()).trim();
        return nextCode;
      },
      { timeout: 30000 }
    )
    .not.toBe(previousCode);

  const nextCode = (await cardCode.innerText()).trim();
  expect(nextCode).toMatch(/^[A-Z0-9]{8}$/);
  return nextCode;
}

export async function rejoinSessionFromActiveCard(page, { childName, expectedCode }) {
  const activeCard = page.locator(".active-session-card").filter({ hasText: childName }).first();
  await expect(activeCard).toBeVisible({ timeout: 30000 });
  await activeCard.getByRole("button", { name: /Rejoin/i }).click();

  await expect(page.locator(".card.card--accent .join-code").first()).toHaveText(expectedCode, {
    timeout: 30000
  });
}

export async function endSessionFromActiveCard(page, { childName }) {
  const activeCard = page.locator(".active-session-card").filter({ hasText: childName }).first();
  if ((await activeCard.count()) === 0) {
    return;
  }

  await activeCard.getByRole("button", { name: /End/i }).click();
  await activeCard.getByRole("button", { name: "Yes" }).click();

  await expect(page.locator(".active-session-card").filter({ hasText: childName })).toHaveCount(0, {
    timeout: 30000
  });
}
