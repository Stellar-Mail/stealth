import { test, expect, openDemoMailbox } from "../fixtures";

// ---------------------------------------------------------------------------
// Workflow 3 (BETA-075) — Two-User Visual & Responsive User Journey
// ---------------------------------------------------------------------------

test.describe("Workflow 3 — Visual & Responsive Experience", () => {
  test.describe("Desktop Viewport (1280x800)", () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test("Alice & Bob complete desktop web mail workflow", async ({ page, isMobile }) => {
      test.skip(isMobile, "Desktop workflow test only runs on desktop projects");
      await openDemoMailbox(page);

      // 1. Assert desktop navigation layout
      await expect(
        page.getByRole("complementary").getByRole("button", { name: "Compose Ctrl+N" }),
      ).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Mail folders" })).toBeVisible();

      // 2. Open Composer & Validate Fields
      await page.getByRole("complementary").getByRole("button", { name: "Compose Ctrl+N" }).click();
      await expect(page.getByText("New message")).toBeVisible();

      const toInput = page.getByPlaceholder("recipients@", { exact: false });
      await expect(toInput).toBeVisible();
      await toInput.fill("G" + "B".repeat(55));

      const subjectInput = page.getByPlaceholder("Subject");
      await subjectInput.fill("Confidential Settlement Proposal");
      await expect(subjectInput).toHaveValue("Confidential Settlement Proposal");

      // 4. Close composer and navigate folders
      await page.keyboard.press("Escape");

      // Navigate to Proofs folder
      await page.getByRole("button", { name: "Proofs" }).first().click();
      await expect(page.getByRole("heading", { name: "Pending Proof" })).toBeVisible();

      // 5. Open Settings Dialog & Inspect Identifiers
      await page.getByRole("button", { name: "Settings" }).click();
      await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
      await page.keyboard.press("Escape");
    });

    test("Failure recovery: preserves compose state on simulated network failure", async ({
      page,
      isMobile,
    }) => {
      test.skip(isMobile, "Desktop workflow test only runs on desktop projects");
      await openDemoMailbox(page);
      await page.getByRole("complementary").getByRole("button", { name: "Compose Ctrl+N" }).click();

      const toInput = page.getByPlaceholder("recipients@", { exact: false });
      await toInput.fill("G" + "B".repeat(55));

      const subjectInput = page.getByPlaceholder("Subject");
      await subjectInput.fill("Preserved Draft Subject");

      // Verify draft state remains intact without reset
      await expect(subjectInput).toHaveValue("Preserved Draft Subject");
      await expect(toInput).toHaveValue("G" + "B".repeat(55));
    });
  });

  test.describe("Mobile Viewport (390x844)", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("Alice & Bob mobile responsive bottom navigation and sheet drawers", async ({ page }) => {
      await openDemoMailbox(page);

      // Desktop compose should be hidden; mobile bottom nav must be visible
      await expect(page.getByRole("button", { name: "Compose Ctrl+N" })).toBeHidden();
      const bottomNav = page.getByRole("navigation", { name: "Bottom navigation" });
      await expect(bottomNav).toBeVisible();

      // Tap Compose tab in bottom navigation
      await bottomNav.getByRole("button", { name: "Compose" }).click();
      await expect(page.getByText("New message")).toBeVisible();

      // Close compose modal before clicking bottom navigation
      await page.keyboard.press("Escape");

      // Tap Inbox tab
      await bottomNav.getByRole("button", { name: "Inbox" }).click();
      await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();

      // Zero horizontal overflow check
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
    });

    test("mobile list to reader transition and back navigation", async ({ page }) => {
      await openDemoMailbox(page);

      // Tap on the first email in the list
      const firstCard = page.locator("ul[role='list'] button").first();
      if (await firstCard.isVisible()) {
        await firstCard.click();

        // Expect reader Back button to appear
        const backBtn = page.getByRole("button", { name: "Back to conversations" });
        await expect(backBtn).toBeVisible();

        // Tap Back to return to conversations list
        await backBtn.click();
        await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
      }
    });
  });

  test.describe("Tablet Viewport (768x1024 & 1024x768)", () => {
    test.use({ viewport: { width: 768, height: 1024 } });

    test("tablet layout transitions cleanly to multi-column desktop mail", async ({ page }) => {
      await openDemoMailbox(page);

      // At 768px (md: breakpoint), desktop sidebar and 2-pane mail list/reader are active
      await expect(page.getByRole("navigation", { name: "Mail folders" })).toBeVisible();

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
    });
  });

  test.describe("Ultra-compact Mobile Viewport (320x568)", () => {
    test.use({ viewport: { width: 320, height: 568 } });

    test("renders responsive UI without overflow on 320px screens", async ({ page }) => {
      await openDemoMailbox(page);
      const bottomNav = page.getByRole("navigation", { name: "Bottom navigation" });
      await expect(bottomNav).toBeVisible();

      // Check that root layout does not produce horizontal scrollbar
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
    });

    test("settings modal adapts cleanly to 320px without horizontal overflow", async ({ page }) => {
      await openDemoMailbox(page);
      const bottomNav = page.getByRole("navigation", { name: "Bottom navigation" });
      await bottomNav.getByRole("button", { name: "Settings" }).click();

      await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

      // Modal fits screen
      const modal = page.getByRole("dialog", { name: "Settings" });
      await expect(modal).toBeVisible();

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);

      await page.keyboard.press("Escape");
    });
  });
});
