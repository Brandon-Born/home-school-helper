import { expect, test } from "@playwright/test";
import {
  createChildProfile,
  createUniqueChildName,
  endSessionFromActiveCard,
  openParentConsole,
  startSessionForChild
} from "./helpers/parent-console.js";

test("child can redeem a join code once and second redemption is rejected", async ({ page, browser }) => {
  const childName = createUniqueChildName("PWChildJoin");
  let joinCode = "";

  await openParentConsole(page);
  await createChildProfile(page, { childName, subjects: "Reading, Science" });
  const started = await startSessionForChild(page, { childName, dailySubject: "Reading" });
  joinCode = started.joinCode;

  const baseUrl = new URL(page.url()).origin;
  const childContext = await browser.newContext();
  const childPage = await childContext.newPage();

  try {
    await childPage.goto(`${baseUrl}/child`, { waitUntil: "domcontentloaded" });
    await childPage.getByLabel("Your code").fill(joinCode);
    await childPage.getByRole("button", { name: /Let's go/i }).click();
    await expect(childPage.getByRole("heading", { name: "You're in! ✅" })).toBeVisible({ timeout: 30000 });
    await expect(childPage.getByRole("heading", { name: /What do you want to learn/i })).toBeVisible({
      timeout: 30000
    });

    await childPage.getByRole("button", { name: /Leave lesson/i }).click();
    await expect(childPage.getByRole("heading", { name: /Ready to learn/i })).toBeVisible({ timeout: 30000 });

    await childPage.getByLabel("Your code").fill(joinCode);
    await childPage.getByRole("button", { name: /Let's go/i }).click();
    await expect(childPage.locator(".alert--error")).toBeVisible({ timeout: 30000 });
  } finally {
    await childContext.close();
    await endSessionFromActiveCard(page, { childName });
  }
});
