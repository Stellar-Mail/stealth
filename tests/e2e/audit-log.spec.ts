import { test, expect, openDemoMailbox } from "./fixtures";

test.describe("audit log", () => {
  test.beforeEach(async ({ page }) => {
    await openDemoMailbox(page);
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await page.getByRole("tab", { name: "Audit log" }).click();
  });

  test("renders events with summary, actor, and timestamp", async ({ page }) => {
    await expect(page.getByText("Session started")).toBeVisible();
    await expect(page.getByText("Demo Operator")).toBeVisible();

    const events = page.getByRole("article");
    const count = await events.count();
    expect(count).toBeGreaterThan(0);

    await expect(page.getByText(/Showing \d+ of 14 events/)).toBeVisible();
  });

  test("filters by category", async ({ page }) => {
    await page.getByRole("button", { name: "Billing", exact: true }).click();
    await expect(page.getByText("Postage attached for incoming message")).toBeVisible();
    await expect(page.getByText("Postage settled for msg_4f2a")).toBeVisible();
    await expect(page.getByText("Session started")).not.toBeVisible();
  });

  test("searches by summary text", async ({ page }) => {
    await page
      .getByPlaceholder("Search summaries, kinds, senders, or message IDs…")
      .fill("bounced");
    await expect(page.getByText("Message bounced")).toBeVisible();
    await expect(page.getByText("Session started")).not.toBeVisible();
  });

  test("searches by message ID", async ({ page }) => {
    await page
      .getByPlaceholder("Search summaries, kinds, senders, or message IDs…")
      .fill("msg_4f2a");
    await expect(page.getByText("msg_4f2a")).toBeVisible();
  });

  test("clears search and restores all events", async ({ page }) => {
    await page
      .getByPlaceholder("Search summaries, kinds, senders, or message IDs…")
      .fill("bounced");
    await expect(page.getByText("Message bounced")).toBeVisible();

    await page.getByRole("button", { name: "Clear search" }).click();
    await expect(page.getByText("Session started")).toBeVisible();
  });

  test("shows empty state when no events match filters", async ({ page }) => {
    await page
      .getByPlaceholder("Search summaries, kinds, senders, or message IDs…")
      .fill("zzzznotfound");
    await expect(page.getByText("No events match these filters")).toBeVisible();
    await expect(page.getByRole("button", { name: "Clear filters" })).toBeVisible();
  });

  test("clear filters button restores all events from no-match state", async ({ page }) => {
    await page
      .getByPlaceholder("Search summaries, kinds, senders, or message IDs…")
      .fill("zzzznotfound");
    await expect(page.getByText("No events match these filters")).toBeVisible();

    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.getByText("Session started")).toBeVisible();
  });

  test("copy and export buttons are enabled when events are visible", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Copy diagnostics" })).toBeEnabled();
    await expect(page.getByRole("button", { name: /^Export JSON/ })).toBeEnabled();
  });

  test("shows events count and total", async ({ page }) => {
    await expect(page.getByText(/Showing \d+ of 14 events/)).toBeVisible();

    await page.getByRole("button", { name: "Billing", exact: true }).click();
    await expect(page.getByText(/Showing \d+ of 14 events for the current filters/)).toBeVisible();
  });
});
