import { defineConfig, devices } from "@playwright/test";

const testPort = Number(process.env.PLAYWRIGHT_PORT ?? "3000");
const baseUrl = `http://127.0.0.1:${testPort}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: baseUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium-4k",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 3840, height: 2160 },
      },
    },
  ],
  webServer: {
    command: `pnpm exec next dev --port ${testPort}`,
    url: `${baseUrl}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
