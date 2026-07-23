import { test, expect, openDemoMailbox } from "./fixtures";
import type { Page } from "@playwright/test";

test.describe("policy editing", () => {
  test.beforeEach(async ({ page }) => {
    await openDemoMailbox(page);
  });

  async function openSettings(page: Page) {
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  }

  test("switches to Inbox control tab and changes unknown-sender policy", async ({ page }) => {
    await openSettings(page);
    await page.getByRole("tab", { name: "Inbox control" }).click();
    await expect(page.getByRole("heading", { name: "Inbox control" })).toBeVisible();

    await page.getByRole("button", { name: "Verified only" }).click();
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByText(/Settings saved/i)).toBeVisible();
  });

  test("updates minimum postage value and saves", async ({ page }) => {
    await openSettings(page);
    await page.getByRole("tab", { name: "Inbox control" }).click();
    await page.locator('input[inputmode="decimal"]').last().fill("0.001");

    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText(/Settings saved/i)).toBeVisible();
  });
});
