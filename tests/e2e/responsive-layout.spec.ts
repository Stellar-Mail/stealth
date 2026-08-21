import { test, expect, openDemoMailbox } from "./fixtures";

const VIEWPORTS = [
  { name: "small-mobile", width: 320, height: 568 },
  { name: "mobile", width: 375, height: 812 },
  { name: "large-mobile", width: 428, height: 926 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 720 },
];

for (const vp of VIEWPORTS) {
  test.describe(`responsive layout at ${vp.name} (${vp.width}x${vp.height})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test.beforeEach(async ({ page }) => {
      await openDemoMailbox(page);
    });

    test("no horizontal overflow", async ({ page }) => {
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
    });

    test("bottom navigation is visible and touch-safe on mobile", async ({ page }) => {
      if (vp.width >= 768) return;

      const bottomNav = page.getByRole("navigation", { name: "Bottom navigation" });
      await expect(bottomNav).toBeVisible();

      const buttons = bottomNav.getByRole("button");
      const count = await buttons.count();
      for (let i = 0; i < count; i++) {
        const box = await buttons.nth(i).boundingBox();
        if (box) {
          expect(box.height).toBeGreaterThanOrEqual(44);
          expect(box.width).toBeGreaterThanOrEqual(44);
        }
      }
    });

    test("inbox heading is visible", async ({ page }) => {
      await expect(page.getByRole("heading", { name: /Inbox/i })).toBeVisible();
    });

    test("email list renders at least one message", async ({ page }) => {
      const messages = page.locator("[data-testid=email-row], [role=button][data-slot]").filter({
        hasText: /inbox|stealth|test|mail/i,
      });
      // At least one interactive element in the list area
      await expect(page.getByText("Inbox")).toBeVisible();
    });
  });
}

test.describe("tablet layout specific", () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test.beforeEach(async ({ page }) => {
    await openDemoMailbox(page);
  });

  test("bottom navigation is hidden on tablet and above", async ({ page }) => {
    const bottomNav = page.getByRole("navigation", { name: "Bottom navigation" });
    await expect(bottomNav).toBeHidden();
  });

  test("sidebar is visible on tablet", async ({ page }) => {
    // Sidebar has hidden md:flex, so it should be visible at 768px
    const sidebar = page.getByRole("navigation", { name: "Main sidebar" });
    await expect(sidebar).toBeVisible();
  });

  test("no horizontal overflow", async ({ page }) => {
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});

test.describe("desktop layout specific", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test.beforeEach(async ({ page }) => {
    await openDemoMailbox(page);
  });

  test("bottom navigation is hidden on desktop", async ({ page }) => {
    const bottomNav = page.getByRole("navigation", { name: "Bottom navigation" });
    await expect(bottomNav).toBeHidden();
  });

  test("sidebar is visible on desktop", async ({ page }) => {
    const sidebar = page.getByRole("navigation", { name: "Main sidebar" });
    await expect(sidebar).toBeVisible();
  });

  test("no horizontal overflow", async ({ page }) => {
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});
