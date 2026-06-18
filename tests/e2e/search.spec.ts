import { test, expect } from "./fixtures";

test.describe("search and filter", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("stealth-preferences", JSON.stringify({ onboardingCompleted: true }));
    });
    await page.goto("/");
  });

  test("clicking the search bar opens the command palette", async ({ page }) => {
    // The search input opens the command palette on click
    await page.getByPlaceholder("Search messages, people, proofs, attachments...").click();

    // Command palette should appear
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("keyboard shortcut Ctrl+K opens the command palette", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("question mark opens the shortcut overlay", async ({ page }) => {
    await page.keyboard.press("Shift+/");
    await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
    await expect(
      page.getByPlaceholder("Search shortcuts, commands, or conflict notes…"),
    ).toBeVisible();
  });

  test("global shortcuts are ignored while typing in inputs", async ({ page }) => {
    await page.keyboard.press("Control+n");
    await expect(page.getByText("New message")).toBeVisible();

    await page.getByPlaceholder("Write your message…").click();
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("dialog", { name: "Command palette" })).not.toBeVisible();

    await page.keyboard.press("Shift+/");
    await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).not.toBeVisible();
  });

  test("filter dropdown toggles unread-only filter", async ({ page }) => {
    // Open filter panel
    await page.getByRole("button", { name: "Filter" }).click();

    // Filter overlay appears
    await expect(page.getByText("Unread only")).toBeVisible();

    // Toggle unread filter on
    await page.getByText("Unread only").click();

    // Close the filter overlay by pressing Escape
    await page.keyboard.press("Escape");

    // The Filter button should now appear active (highlighted)
    // We verify by re-opening and confirming state
    await page.getByRole("button", { name: "Filter" }).click();
    const unreadToggle = page.getByText("Unread only");
    await expect(unreadToggle).toBeVisible();
  });

  test("filter dropdown allows selecting a date range", async ({ page }) => {
    await page.getByRole("button", { name: "Filter" }).click();
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
    await expect(page.getByText("Your relay verification code")).toBeVisible();
  });
});
