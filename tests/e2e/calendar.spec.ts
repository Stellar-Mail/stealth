import { test, expect, openDemoMailbox } from "./fixtures";

test.describe("calendar linking", () => {
  test.beforeEach(async ({ page }) => {
    await openDemoMailbox(page);
  });

  async function openFounderPass(page: Parameters<typeof openDemoMailbox>[0]) {
    await page.getByRole("button", { name: /TOKEN2049 Abu Dhabi.*founder pass ready/i }).click();
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "TOKEN2049 Abu Dhabi - founder pass ready",
      }),
    ).toBeVisible();
  }

  test("adds a calendar event from a mail with an event attachment", async ({ page }) => {
    await openFounderPass(page);

    await page.getByRole("button", { name: /Add to calendar/i }).click();
    await expect(page.getByText(/added to your calendar/i)).toBeVisible();
  });

  test("opens the calendar workspace from the sidebar calendar button", async ({ page }) => {
    await openFounderPass(page);

    await page.getByRole("button", { name: /Add to calendar/i }).click();
    await page.getByRole("button", { name: /Open calendar/i }).click();

    await expect(page.getByText("Private scheduling")).toBeVisible();
    await expect(page.getByText("TOKEN2049 Abu DhabiTuesday, April 21, 2026")).toBeVisible();
  });

  test("calendar workspace closes on close button click", async ({ page }) => {
    await openFounderPass(page);

    await page.getByRole("button", { name: /Add to calendar/i }).click();
    await page.getByRole("button", { name: /Open calendar/i }).click();
    await page.getByRole("button", { name: "Close calendar" }).click();

    await expect(page.getByText("Private scheduling")).not.toBeVisible();
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "TOKEN2049 Abu Dhabi - founder pass ready",
      }),
    ).toBeVisible();
  });
  test("calendar workspace handles manual event creation and deletion", async ({ page }) => {
    await openFounderPass(page);
    await page.getByRole("button", { name: /Add to calendar/i }).click();
    await page.getByRole("button", { name: /Open calendar/i }).click();

    // Create a new event
    await page.getByRole("button", { name: /New event/i }).click();
    await page.getByPlaceholder("What is happening?").fill("My Custom Meeting");
    await page.getByRole("button", { name: /Create event/i }).click();

    await expect(page.getByRole("heading", { name: "My Custom Meeting" })).toBeVisible();
    await expect(page.getByText("Event created")).toBeVisible();

    // Delete the event
    await page.getByRole("button", { name: /Delete/i }).click();
    await expect(page.getByText("Event deleted")).toBeVisible();
    await expect(page.getByText("My Custom Meeting")).toHaveCount(0);
  });
});
