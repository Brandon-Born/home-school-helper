import { defineConfig, devices } from "@playwright/test";

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
const reuseExistingServer = !["0", "false", "no", "off"].includes(
  String(process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER ?? "1")
    .trim()
    .toLowerCase()
);

export default defineConfig({
  testDir: "./tests/playwright",
  fullyParallel: false,
  workers: 1,
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
  ],
  webServer: {
    command: "npm run dev",
    url: baseURL,
    timeout: 120000,
    reuseExistingServer
  }
});
