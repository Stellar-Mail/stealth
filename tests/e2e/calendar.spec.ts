import { test, expect, openDemoMailbox } from "./fixtures";

test.describe("calendar linking", () => {
  test.beforeEach(async ({ page }) => {
    await openDemoMailbox(page);
  });

  test("adds a calendar event from a mail with an event attachment", async ({ page }) => {
    await page.getByRole("button", { name: "Verified 1" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "TOKEN2049 Abu Dhabi - founder pass ready" }),
    ).toBeVisible();

    await page.getByRole("button", { name: /Add to calendar/i }).click();
    await expect(page.getByText(/added to your calendar/i)).toBeVisible();
  });

  test("opens the calendar workspace from the sidebar calendar button", async ({ page }) => {
    await page.getByRole("button", { name: "Verified 1" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "TOKEN2049 Abu Dhabi - founder pass ready" }),
    ).toBeVisible();

    await page.getByRole("button", { name: /Add to calendar/i }).click();
    await page.getByRole("button", { name: /Open calendar/i }).click();

    await expect(page.getByText("Private scheduling")).toBeVisible();
    await expect(page.getByText("TOKEN2049 Abu DhabiTuesday, April 21, 2026")).toBeVisible();
  });

  test("calendar workspace closes on close button click", async ({ page }) => {
    await page.getByRole("button", { name: "Verified 1" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "TOKEN2049 Abu Dhabi - founder pass ready" }),
    ).toBeVisible();

    await page.getByRole("button", { name: /Add to calendar/i }).click();
    await page.getByRole("button", { name: /Open calendar/i }).click();
    await page.getByRole("button", { name: "Close calendar" }).click();

    await expect(page.getByText("Private scheduling")).not.toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: "TOKEN2049 Abu Dhabi - founder pass ready" }),
    ).toBeVisible();
  });
});
