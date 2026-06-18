import { test, expect, openDemoMailbox } from "./fixtures";

test.describe("compose flow", () => {
  test.beforeEach(async ({ page }) => {
    await openDemoMailbox(page);
  });

  test("opens compose, fills fields, and sends message", async ({ page }) => {
    await page.getByRole("complementary").getByRole("button", { name: "Compose Ctrl+N" }).click();
    await expect(page.getByText("New message")).toBeVisible();

    await page.getByPlaceholder("recipients@", { exact: false }).fill("alice*stellar.org");
    await page.getByPlaceholder("Subject").fill("E2E test subject");
    await page.getByPlaceholder("Write your message", { exact: false }).fill("Hello from E2E test");
    await expect(page.getByText("alice*stellar.org")).toBeVisible();

    await page.getByRole("button", { name: "Send", exact: true }).click();

    await expect(page.getByText("New message")).not.toBeVisible();
    await expect(page.getByText(/Encrypted message sent/i)).toBeVisible();
  });

  test("validates required fields before sending", async ({ page }) => {
    await page.getByRole("complementary").getByRole("button", { name: "Compose Ctrl+N" }).click();
    await expect(page.getByText("New message")).toBeVisible();

    await page.getByRole("button", { name: "Send", exact: true }).click();

    await expect(page.getByText("New message")).toBeVisible();
    await expect(page.getByText(/Please add at least one recipient/i)).toBeVisible();
  });

  test("schedules message instead of immediate send", async ({ page }) => {
    await page.getByRole("complementary").getByRole("button", { name: "Compose Ctrl+N" }).click();
    await expect(page.getByText("New message")).toBeVisible();

    await page.getByPlaceholder("recipients@", { exact: false }).fill("bob*stellar.org");
    await page.getByPlaceholder("Subject").fill("Scheduled message");
    await page.getByPlaceholder("Write your message", { exact: false }).fill("Sent later");
    await expect(page.getByText("bob*stellar.org")).toBeVisible();

    await page.getByRole("button", { name: "Schedule", exact: true }).click();

    await expect(page.getByText("New message")).not.toBeVisible();
    await expect(page.getByText(/Message scheduled with postage reserved/i)).toBeVisible();
  });
});
