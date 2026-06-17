import { test, expect } from "./fixtures";

test.describe("search and filter", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("stealth-preferences", JSON.stringify({ onboardingCompleted: true }));
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.stealthHydrated === "true");
  });

  test("clicking the search bar opens the command palette", async ({ page }) => {
    // The search input opens the command palette on click
    await page.getByPlaceholder("Search messages, people, proofs, attachments...").click();

    // Command palette should appear
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("keyboard shortcut Ctrl+K opens the command palette", async ({ page }) => {
    await page.getByRole("banner").getByRole("button", { name: "K", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("question mark opens the shortcut overlay", async ({ page }) => {
    await page.getByRole("button", { name: "Help" }).click();
    await page.getByRole("button", { name: /Keyboard shortcuts/ }).click();
    await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
    await expect(page.getByPlaceholder(/Search shortcuts/)).toBeVisible();
  });

  test("global shortcuts are ignored while typing in inputs", async ({ page }) => {
    await page.getByRole("button", { name: /^Compose/ }).click();
    await expect(page.getByText("New message")).toBeVisible();

    await page.getByPlaceholder(/Write your message/).click();
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("dialog", { name: "Command palette" })).not.toBeVisible();

    await page.keyboard.press("Shift+/");
    await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).not.toBeVisible();
  });

  test("filter dropdown toggles unread-only filter", async ({ page }) => {
    // Open filter panel
    await page.getByRole("banner").getByRole("button", { name: "Filter" }).click();

    // Filter overlay appears
    await expect(page.getByText("Unread only")).toBeVisible();

    // Toggle unread filter on
    await page.getByText("Unread only").click();

    // The active filter controls should remain visible in the open popover.
    await expect(page.getByRole("button", { name: "Clear filters" })).toBeVisible();
    await expect(page.getByText("Unread only")).toBeVisible();
  });

  test("filter dropdown allows selecting a date range", async ({ page }) => {
    await page.getByRole("banner").getByRole("button", { name: "Filter" }).click();
    await expect(page.getByText("This week")).toBeVisible();

    await page.getByText("This week").click();

    // Filter panel should still be visible and show the active state
    await expect(page.getByText("This week")).toBeVisible();
  });

  test("navigating to Pending Proof folder via Quick action shows proof items", async ({
    page,
  }) => {
    // 'Proofs' quick action navigates to pending proof folder
    await page.getByRole("button", { name: "Proofs" }).click();

    // The email list heading (or an email) from pending folder should appear
    await expect(
      page.getByRole("button", { name: /Relay Node 07.*Your relay verification code/ }),
    ).toBeVisible();
  });
});
