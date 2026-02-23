import { expect, test } from "@playwright/test";

function jsonResponse(route, payload, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(payload)
  });
}

test("parent workspace shows loading view while parent data is still loading", async ({ page }) => {
  await page.route("**/api/parent/me", async (route) => {
    await jsonResponse(route, {
      parent: {
        id: "parent_loading_test",
        coppa_consent_required: true,
        coppa_consent_status: "pending"
      }
    });
  });

  await page.route("**/api/children", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }

    // Keep one request pending long enough to verify the loading UI branch.
    await page.waitForTimeout(1200);
    await jsonResponse(route, {
      children: []
    });
  });

  await page.route("**/api/session/active", async (route) => {
    await jsonResponse(route, { sessions: [] });
  });

  await page.route("**/api/privacy/child-data-summary", async (route) => {
    await jsonResponse(route, {
      summary: {
        generated_at: "2026-02-23T00:00:00.000Z",
        counts: {
          children: 0,
          sessions: 0,
          transcript_messages: 0,
          parent_only_messages: 0
        }
      }
    });
  });

  await page.route("**/api/privacy/requests", async (route) => {
    await jsonResponse(route, { requests: [] });
  });

  await page.goto("/parent", { waitUntil: "domcontentloaded" });

  await expect(page.getByText("Signed in as")).toBeVisible({ timeout: 30000 });
  await expect(page.getByTestId("parent-workspace-loading")).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole("heading", { name: "Loading your data" })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("No children added yet — add one to get started.")).toHaveCount(0);
  await page.screenshot({
    path: "output/playwright/parent-workspace-loading.png",
    fullPage: true
  });

  await expect(page.getByRole("heading", { name: "Your children" })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("No children added yet — add one to get started.")).toBeVisible({ timeout: 30000 });
  await expect(page.getByTestId("parent-workspace-loading")).toHaveCount(0);
  await page.screenshot({
    path: "output/playwright/parent-workspace-loaded-empty.png",
    fullPage: true
  });
});
