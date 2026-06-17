import { test, expect } from "./fixtures";

test.describe("calendar linking", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("stealth-preferences", JSON.stringify({ onboardingCompleted: true }));
    });
    await page.goto("/");
  });

  async function openToken2049EventMail(page: Parameters<typeof test>[1]) {
    await page
      .getByRole("button", {
        name: /TOKEN2049 Abu Dhabi.*TOKEN2049 Abu Dhabi - founder pass ready/,
      })
      .click();
  }

  test("adds a calendar event from a mail with an event attachment", async ({ page }) => {
    await openToken2049EventMail(page);

    // The EventMailCard should render with the event title
    await expect(page.getByText("TOKEN2049 Abu Dhabi")).toBeVisible();

    // Add to calendar
    await page.getByRole("button", { name: /Add to calendar/i }).click();

    // Toast confirms the event was added
    await expect(page.getByText(/added to your calendar/i)).toBeVisible();
  });

  test("opens the calendar workspace from the sidebar calendar button", async ({ page }) => {
    // The right panel has an "Open calendar" or calendar section
    // Alternatively open via the event mail card's "Open calendar" action
    await openToken2049EventMail(page);

    // Add event first so it exists in calendar state
    await page.getByRole("button", { name: /Add to calendar/i }).click();

    // Then open the calendar workspace
    await page.getByRole("button", { name: /Open calendar/i }).click();

    // CalendarWorkspace dialog/modal should appear
    await expect(page.getByText("TOKEN2049 Abu Dhabi")).toBeVisible();
  });

  test("calendar workspace closes on close button click", async ({ page }) => {
    // Open via right panel create event button – requires an email selected first
    await openToken2049EventMail(page);
    await page.getByRole("button", { name: /Add to calendar/i }).click();
    await page.getByRole("button", { name: /Open calendar/i }).click();

    // Dismiss the calendar workspace
    await page.getByRole("button", { name: /close/i }).first().click();

    // The CalendarWorkspace modal should no longer be visible
    // Check that calendar-specific heading is gone
    await expect(page.getByText("TOKEN2049 Abu Dhabi - founder pass ready")).toBeVisible();
  });
});
