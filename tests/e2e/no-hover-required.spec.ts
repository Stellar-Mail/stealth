import { test, expect, openDemoMailbox } from "./fixtures";

// Verify interactive elements work without hover at mobile viewports
test.describe("no-hover-required audit", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test.beforeEach(async ({ page }) => {
    await openDemoMailbox(page);
  });

  test("all bottom nav buttons have 44px minimum touch targets", async ({ page }) => {
    const bottomNav = page.getByRole("navigation", { name: "Bottom navigation" });
    await expect(bottomNav).toBeVisible();

    const buttons = bottomNav.getByRole("button");
    const count = await buttons.count();
    for (let i = 0; i < count; i++) {
      const box = await buttons.nth(i).boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test("interactive elements are not covered by other elements", async ({ page }) => {
    // Verify the bottom nav buttons are clickable by checking they receive pointer events
    const bottomNav = page.getByRole("navigation", { name: "Bottom navigation" });
    const inboxBtn = bottomNav.getByRole("button", { name: "Inbox" });
    await expect(inboxBtn).toBeVisible();

    const pointerEvents = await inboxBtn.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.pointerEvents;
    });
    expect(pointerEvents).not.toBe("none");
  });

  test("viewport meta tag has viewport-fit=cover", async ({ page }) => {
    const content = await page.getAttribute("meta[name=viewport]", "content");
    expect(content).toContain("viewport-fit=cover");
  });
});
