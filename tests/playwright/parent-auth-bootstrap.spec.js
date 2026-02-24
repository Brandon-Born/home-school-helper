import { expect, test } from "@playwright/test";
import { ensureCoppaConsentGranted, goToParentSection } from "./helpers/parent-console.js";

test("parent console is accessible with bootstrap auth state", async ({ page }) => {
  await page.goto("/parent", { waitUntil: "domcontentloaded" });

  await expect(page.getByText("Signed in as")).toBeVisible({ timeout: 30000 });
  await ensureCoppaConsentGranted(page);
  await expect(page.getByRole("heading", { name: "Your children" })).toBeVisible({ timeout: 30000 });
  await goToParentSection(page, "managed");
  await expect(page.getByRole("heading", { name: "Child data summary" })).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole("button", { name: /Sign in with Google|Sign in again/i })).toHaveCount(0);
  const profileResponsePromise = page.waitForResponse(
    (response) => response.url().includes("/api/parent/me") && response.request().method() === "GET"
  );
  await page.getByRole("button", { name: "Refresh" }).click();
  const profileResponse = await profileResponsePromise;
  expect(profileResponse.status()).toBe(200);
  await expect(page.locator(".alert--error")).toHaveCount(0);
});

test("parent section navigation works on mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/parent", { waitUntil: "domcontentloaded" });

  await expect(page.getByText("Signed in as")).toBeVisible({ timeout: 30000 });
  await ensureCoppaConsentGranted(page);
  await expect(page.getByTestId("parent-section-link-children")).toBeVisible({ timeout: 30000 });
  await expect(page.getByTestId("parent-section-link-sessions")).toBeVisible({ timeout: 30000 });
  await expect(page.getByTestId("parent-section-link-managed")).toBeVisible({ timeout: 30000 });

  await goToParentSection(page, "sessions");
  await expect(page.getByRole("heading", { name: "Session controls" })).toBeVisible({ timeout: 30000 });

  await goToParentSection(page, "managed");
  await expect(page.getByRole("heading", { name: "Subscription & consent" })).toBeVisible({ timeout: 30000 });

  await goToParentSection(page, "children");
  await expect(page.getByRole("heading", { name: "Your children" })).toBeVisible({ timeout: 30000 });
});
