import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;

// Sandboxed dev environments (e.g. cloud agent sessions) often can't download
// Playwright's pinned browser build. Point this at a preinstalled Chromium to
// run the suite against it instead, e.g.:
//   PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium/chrome pnpm test
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    viewport: { width: 960, height: 720 },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(chromiumPath ? { launchOptions: { executablePath: chromiumPath } } : {}),
      },
    },
  ],
  webServer: {
    command: "pnpm build && pnpm preview",
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
  outputDir: "test-results/",
});
