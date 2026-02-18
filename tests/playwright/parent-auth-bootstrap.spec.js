import { expect, test } from "@playwright/test";

test("parent console is accessible with bootstrap auth state", async ({ page }) => {
  await page.goto("/parent", { waitUntil: "domcontentloaded" });

  await expect(page.getByText("Signed in as")).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole("heading", { name: "Your children" })).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole("button", { name: /Sign in with Google|Sign in again/i })).toHaveCount(0);
  const profileResponsePromise = page.waitForResponse(
    (response) => response.url().includes("/api/parent/me") && response.request().method() === "GET"
  );
  await page.getByRole("button", { name: "Refresh" }).click();
  const profileResponse = await profileResponsePromise;
  expect(profileResponse.status()).toBe(200);
  await expect(page.locator(".alert--error")).toHaveCount(0);
});
