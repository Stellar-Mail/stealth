import { test, expect, openDemoMailbox } from "./fixtures";

test.describe("search and filter", () => {
  test.beforeEach(async ({ page }) => {
    await openDemoMailbox(page);
  });

  test("clicking the search bar opens the command palette", async ({ page }) => {
    await page.getByPlaceholder("Search messages, people, proofs, attachments...").click();
    await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
  });

  test("keyboard shortcut Ctrl+K opens the command palette", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
  });

  test("question mark opens the shortcut overlay", async ({ page }) => {
    await page.keyboard.press("?");
    await expect(page.getByText("Keyboard shortcuts")).toBeVisible();
    await expect(page.getByPlaceholder("Search shortcuts", { exact: false })).toBeVisible();
  });

  test("global shortcuts are ignored while typing in inputs", async ({ page }) => {
    await page.getByRole("complementary").getByRole("button", { name: "Compose Ctrl+N" }).click();
    await expect(page.getByText("New message")).toBeVisible();

    await page.getByPlaceholder("Write your message", { exact: false }).click();
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("dialog", { name: "Command palette" })).not.toBeVisible();

    await page.keyboard.press("Shift+/");
    await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).not.toBeVisible();
  });

  test("filter dropdown toggles unread-only filter", async ({ page }) => {
    await page.getByRole("button", { name: "Filter", exact: true }).click();
    await expect(page.getByRole("button", { name: "Unread only" })).toBeVisible();

    await page.getByRole("button", { name: "Unread only" }).click();
    await expect(page.getByRole("button", { name: "Clear filters" })).toBeVisible();
  });

  test("filter dropdown allows selecting a date range", async ({ page }) => {
    await page.getByRole("button", { name: "Filter", exact: true }).click();
    await expect(page.getByRole("button", { name: "This week" })).toBeVisible();

    await page.getByRole("button", { name: "This week" }).click();
    await expect(page.getByRole("button", { name: "This week" })).toBeVisible();
  });

  test("navigating to Pending Proof folder via Quick action shows proof items", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Proofs" }).click();
    await expect(page.getByRole("heading", { name: "Pending Proof" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Your relay verification code/ })).toBeVisible();
  });
});
