import { expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// BETA-087 (Issue #1994) — stable demo mailbox bootstrap for visual tests.
//
// Mirrors the functional `openDemoMailbox` helper but pins the UI to a
// deterministic appearance so screenshots are comparable across browsers and
// runs:
//   - `showAvatars: false` — avoids depending on the external dicebear image
//     service (which is unavailable in CI and would render broken images).
//   - `lowerMotion: true`  — requests reduced motion in-app.
//   - Fixed sidebar/list/reader layout sizes.
// ---------------------------------------------------------------------------

const visualUiPreferences = {
  theme: "dark",
  compactMode: false,
  density: "comfortable",
  glassIntensity: "medium",
  readerTypography: "sans",
  lowerMotion: true,
  showAvatars: false,
  receiptOnDelivery: false,
  emailNotifications: false,
  desktopNotifications: false,
  sound: false,
  unknownSenders: "request",
  minimumPostage: "0.0001",
  onboardingCompleted: true,
  receipts: {
    trusted: "auto",
    unknown: "manual",
    paid: "manual",
    organizations: "auto",
  },
};

const visualLayoutPreferences = {
  sidebarWidth: 15,
  sidebarCollapsed: false,
  listWidth: 30,
  readerWidth: 35,
  compactMode: false,
  rightPanelCollapsed: false,
};

export async function openVisualMailbox(page: Page) {
  await page.addInitScript(
    ({ layout, preferences }) => {
      localStorage.setItem("stealth-preferences", JSON.stringify({ onboardingCompleted: true }));
      localStorage.setItem("stealth-ui-preferences", JSON.stringify(preferences));
      localStorage.setItem("stealth-layout-preferences", JSON.stringify(layout));
      localStorage.setItem("STEALTH_DEMO_BYPASS_FETCH", "true");
    },
    {
      layout: visualLayoutPreferences,
      preferences: visualUiPreferences,
    },
  );

  await page.goto("/demo");
  await expect(page.getByRole("heading", { name: /Inbox/i })).toBeVisible({ timeout: 60000 });
  await page.waitForFunction(() => Boolean(document.documentElement.dataset.theme));
}
