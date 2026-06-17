import { test, expect } from "./fixtures";

test.describe("compose flow", () => {
  test.beforeEach(async ({ page }) => {
    // Skip onboarding by pre-setting localStorage
    await page.addInitScript(() => {
      localStorage.setItem("stealth-preferences", JSON.stringify({ onboardingCompleted: true }));
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.stealthHydrated === "true");
  });

  async function openCompose(page: Parameters<typeof test>[1]) {
    const composeButton = page.getByRole("button", { name: /^Compose/ });
    await expect(composeButton).toBeVisible();
    await composeButton.evaluate((button) => (button as HTMLButtonElement).click());
    await expect(page.getByText("New message")).toBeVisible();
  }

  test("opens compose, fills fields, and sends message", async ({ page }) => {
    await openCompose(page);

    // Fill recipient, subject, and body
    await page.getByPlaceholder(/recipients@/).fill("alice*stellar.org");
    await page.getByPlaceholder("Subject").fill("E2E test subject");
    await page.getByPlaceholder(/Write your message/).fill("Hello from E2E test");

    // Send
    await page.getByRole("button", { name: "Send", exact: true }).click();

    // Dialog closes and toast confirms delivery
    await expect(page.getByText("New message")).not.toBeVisible();
    await expect(page.getByText(/Encrypted message sent/i)).toBeVisible();
  });

  test("validates required fields before sending", async ({ page }) => {
    await openCompose(page);

    // Attempt to send with empty recipient
    await page.getByRole("button", { name: "Send", exact: true }).click();

    // Dialog stays open; error toast shown
    await expect(page.getByText("New message")).toBeVisible();
    await expect(page.getByText(/Please add at least one recipient/i)).toBeVisible();
  });

  test("schedules message instead of immediate send", async ({ page }) => {
    await openCompose(page);

    await page.getByPlaceholder(/recipients@/).fill("bob*stellar.org");
    await page.getByPlaceholder("Subject").fill("Scheduled message");
    await page.getByPlaceholder(/Write your message/).fill("Sent later");

    await page.getByRole("button", { name: "Schedule", exact: true }).click();

    await expect(page.getByText("New message")).not.toBeVisible();
    await expect(page.getByText("Message scheduled with postage reserved")).toBeVisible();
  });
});
