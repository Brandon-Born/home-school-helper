import { defineConfig, devices } from "@playwright/test";

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./tests/playwright",
  fullyParallel: true,
  reporter: "list",
  retries: process.env.CI ? 2 : 0,
  globalSetup: "./tests/playwright/global.setup.mjs",
  use: {
    baseURL,
    trace: "on-first-retry",
    storageState: "./tests/playwright/.auth/parent.json"
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"]
      }
    }
  ]
});
