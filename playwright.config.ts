import { defineConfig, devices } from "@playwright/test";

/**
 * Visual / screenshot tests for the Stealth mail client.
 *
 * Snapshots live in tests/visual/__snapshots__.
 * To update: npm run test:screenshots -- --update-snapshots
 */
export default defineConfig({
  testDir: "./tests/visual",
  testMatch: "**/*.screenshot.ts",
  outputDir: "./tests/visual/__results__",
  snapshotDir: "./tests/visual/__snapshots__",
  snapshotPathTemplate:
    "{snapshotDir}/{testFilePath}/{arg}-{projectName}{ext}",

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,

  use: {
    baseURL: "http://localhost:8080",
    // Disable animations for deterministic snapshots
    reducedMotion: "reduce",
    // Use a consistent color scheme
    colorScheme: "dark",
    // Capture screenshot on failure
    screenshot: "only-on-failure",
    // Consistent font rendering
    deviceScaleFactor: 1,
  },

  expect: {
    // Pixel-diff tolerance (0–1). Tighter than default to catch regressions.
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      animations: "disabled",
    },
  },

  projects: [
    // Desktop — primary reference
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    // Tablet — two-panel collapse boundary
    {
      name: "tablet",
      use: {
        ...devices["iPad (gen 7)"],
        viewport: { width: 768, height: 1024 },
      },
    },
    // Mobile — single-panel
    {
      name: "mobile",
      use: {
        ...devices["iPhone 14"],
        viewport: { width: 390, height: 844 },
      },
    },
  ],

  // Dev server — only started when the app is not already running
  webServer: {
    command: "npm run dev",
    url: "http://localhost:8080",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
