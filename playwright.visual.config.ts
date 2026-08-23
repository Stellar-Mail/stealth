import { defineConfig, devices } from "@playwright/test";

// ---------------------------------------------------------------------------
// BETA-087 (Issue #1994) — cross-browser compatibility & visual regression.
//
// This is a dedicated Playwright project set that runs ONLY the visual suite
// under tests/e2e/visual. It is intentionally separate from playwright.config.ts
// (which drives the functional E2E suite on Chromium only) so that adding
// Firefox/WebKit and mobile viewports here does not multiply the runtime of the
// existing functional suite or break desktop-only functional assertions.
//
// Snapshots are keyed by {projectName} only — the CI platform (Linux) is the
// canonical baseline source. Cross-browser diffs are detected per project;
// cross-platform diffs are intentionally out of scope for this suite.
// ---------------------------------------------------------------------------

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5173";

export default defineConfig({
  testDir: "./tests/e2e/visual",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // One worker keeps screenshot capture deterministic and avoids web-server
  // contention across the five browser/viewport projects.
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 60_000,
    toHaveScreenshot: {
      // Disable CSS animations/transitions and hide the caret so snapshots
      // capture a settled frame regardless of motion preferences.
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.02,
      threshold: 0.2,
    },
  },
  // Baselines are stored per project. The CI platform (Linux) is the canonical
  // source; see tests/e2e/visual/README.md for the update workflow.
  snapshotPathTemplate: "{testDir}/__screenshots__/{projectName}/{arg}{ext}",
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "on-failure" }]],
  use: {
    baseURL: BASE_URL,
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    reducedMotion: "reduce",
  },
  projects: [
    // Desktop browsers — the core "no critical workflow is browser-specific"
    // acceptance gate.
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox-desktop",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit-desktop",
      use: { ...devices["Desktop Safari"] },
    },
    // Representative mobile viewports — Android-sized and iOS-sized.
    {
      name: "chromium-mobile",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "webkit-mobile",
      use: { ...devices["iPhone 13"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
