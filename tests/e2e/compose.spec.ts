import { test, expect } from "./fixtures";

test.describe("compose flow", () => {
  test.beforeEach(async ({ page }) => {
    // Skip onboarding by pre-setting localStorage
    await page.addInitScript(() => {
      localStorage.setItem("stealth-preferences", JSON.stringify({ onboardingCompleted: true }));
    });
    await page.goto("/");
  });

  test("opens compose, fills fields, and sends message", async ({ page }) => {
    // Open compose via keyboard shortcut
    await page.keyboard.press("Control+n");

    // Compose dialog becomes visible
    await expect(page.getByText("New message")).toBeVisible();

    // Fill recipient, subject, and body
    await page.getByPlaceholder(/recipients@/).fill("alice*stellar.org");
    await page.getByPlaceholder("Subject").fill("E2E test subject");
    await page.getByPlaceholder(/Write your message/).fill("Hello from E2E test");

    // Send
    await page.getByRole("button", { name: "Send" }).click();

    // Dialog closes and toast confirms delivery
    await expect(page.getByText("New message")).not.toBeVisible();
    await expect(page.getByText(/Encrypted message sent/i)).toBeVisible();
  });

  test("validates required fields before sending", async ({ page }) => {
    await page.keyboard.press("Control+n");
    await expect(page.getByText("New message")).toBeVisible();

    // Attempt to send with empty recipient
    await page.getByRole("button", { name: "Send" }).click();

    // Dialog stays open; error toast shown
    await expect(page.getByText("New message")).toBeVisible();
    await expect(page.getByText(/Please enter a recipient/i)).toBeVisible();
  });

  test("schedules message instead of immediate send", async ({ page }) => {
    await page.keyboard.press("Control+n");

    await page.getByPlaceholder(/recipients@/).fill("bob*stellar.org");
    await page.getByPlaceholder("Subject").fill("Scheduled message");
    await page.getByPlaceholder(/Write your message/).fill("Sent later");

    await page.getByRole("button", { name: "Schedule" }).click();

    await expect(page.getByText("New message")).not.toBeVisible();
    await expect(page.getByText(/scheduled/i)).toBeVisible();
  });
});
