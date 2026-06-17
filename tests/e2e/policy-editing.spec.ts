import { test, expect } from "./fixtures";

test.describe("policy editing", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("stealth-preferences", JSON.stringify({ onboardingCompleted: true }));
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.stealthHydrated === "true");
  });

  async function openSettings(page: Parameters<typeof test>[1]) {
    // Settings button is an IconBtn labelled "Settings" in the topbar
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  }

  test("switches to Inbox control tab and changes unknown-sender policy", async ({ page }) => {
    await openSettings(page);

    // Navigate to the Inbox control tab
    await page.getByRole("button", { name: "Inbox control" }).click();

    // Verify the section heading
    await expect(page.getByRole("heading", { name: "Inbox control" })).toBeVisible();

    // Select "Verified only" policy
    await page.getByRole("button", { name: "Verified only" }).click();

    // Save
    await page.getByRole("button", { name: "Save changes" }).click();

    // Toast confirms save
    await expect(page.getByText(/Settings saved/i)).toBeVisible();
  });

  test("updates minimum postage value and saves", async ({ page }) => {
    await openSettings(page);
    await page.getByRole("button", { name: "Inbox control" }).click();

    // Minimum postage input
    const postageInput = page.getByRole("textbox").filter({ hasText: /^0/ }).first();
    // Use the input near the XLM label
    await page.locator('input[inputmode="decimal"]').last().fill("0.001");

    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText(/Settings saved/i)).toBeVisible();
  });
});
