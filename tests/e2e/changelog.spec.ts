import { test, expect, openDemoMailbox } from "./fixtures";

test.describe("changelog panel", () => {
  test.beforeEach(async ({ page }) => {
    await openDemoMailbox(page);
  });

  test("opens changelog tab in settings and displays release notes", async ({ page }) => {
    // Open Settings modal
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

    // Navigate to "What's new" tab
    await page.getByRole("tab", { name: "What's new" }).click();

    // Assert main header and subheader
    await expect(page.getByRole("heading", { name: "Release notes" })).toBeVisible();
    await expect(
      page.getByText(/UI, API, protocol, and security changes — in plain language\./i),
    ).toBeVisible();

    // Assert release versions are visible
    await expect(page.getByText("v0.4.0", { exact: false })).toBeVisible();
    await expect(page.getByText("Mailbox policy audit log")).toBeVisible();

    // Assert category badges are present
    await expect(page.getByText("Security", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("UI", { exact: true }).first()).toBeVisible();
  });

  test("marks all releases as read upon viewing panel", async ({ page }) => {
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("tab", { name: "What's new" }).click();

    // Viewing the panel triggers markAllSeen(), showing "All read" badge
    await expect(page.getByLabel("All release notes read")).toBeVisible();
    await expect(page.getByText("All read")).toBeVisible();
  });
});
