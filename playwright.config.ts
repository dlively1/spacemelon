import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;

// Sandboxed dev environments (e.g. cloud agent sessions) often can't download
// Playwright's pinned browser build. Point this at a preinstalled Chromium to
// run the suite against it instead, e.g.:
//   PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium/chrome pnpm test
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH;

export default defineConfig({
  testDir: "./tests",
  // Tests are independent (each boots its own page against the shared static
  // preview server), so they can run in parallel workers.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
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
      testIgnore: "**/perf.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        ...(chromiumPath ? { launchOptions: { executablePath: chromiumPath } } : {}),
      },
    },
    {
      // The perf budget test measures frame rate, so it must not share CPU
      // with parallel workers — it runs alone, after the functional suite.
      name: "perf",
      testMatch: "**/perf.spec.ts",
      dependencies: ["chromium"],
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
