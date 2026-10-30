import { test, expect, openDemoMailbox, openMailboxSettings } from "./fixtures";

test.describe("Stealth Work preview", () => {
  test.beforeEach(async ({ page }) => {
    await openDemoMailbox(page);
  });

  test("opening calendar mail does not move either toolbar", async ({ page }) => {
    const navbar = page.locator(".mail-topbar");
    const readerToolbar = page.locator(".mail-reader-toolbar");
    await expect(readerToolbar).toBeVisible();
    const navbarBefore = await navbar.boundingBox();
    const readerBefore = await readerToolbar.boundingBox();
    await page.locator("[data-email-id]").filter({ hasText: "TOKEN2049 Abu Dhabi" }).click();
    await expect(page.locator(".event-mail-hero")).toBeVisible();
    await expect.poll(() => navbar.boundingBox()).toEqual(navbarBefore);
    await expect.poll(() => readerToolbar.boundingBox()).toEqual(readerBefore);
  });

  test("uses its own sidebar and preserves tasks across Personal switches", async ({ page }) => {
    await page.getByRole("button", { name: "Work", exact: true }).click();
    const nav = page.getByRole("navigation", { name: "Work navigation" });
    await expect(nav).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Mail folders" })).not.toBeVisible();
    await nav.getByRole("button", { name: "Tasks", exact: true }).click();
    await page.getByRole("textbox", { name: "Task title" }).fill("Review the founder pass");
    await page.getByRole("button", { name: "Add task" }).click();
    await page.getByRole("checkbox", { name: "Complete Review the founder pass" }).check();
    await page.getByRole("button", { name: "Work", exact: true }).click();
    await expect(page.getByRole("navigation", { name: "Mail folders" })).toBeVisible();
    await page.getByRole("button", { name: "Work", exact: true }).click();
    await expect(
      page.getByRole("checkbox", { name: "Complete Review the founder pass" }),
    ).toBeChecked();
    await page.getByRole("button", { name: "Delete Review the founder pass" }).click();
    await expect(page.getByText("Review the founder pass", { exact: true })).not.toBeVisible();
  });

  test("keeps notes scoped to a conversation and out of sent mail", async ({ page }) => {
    await page.getByRole("button", { name: "Work", exact: true }).click();
    await page
      .getByRole("navigation", { name: "Work navigation" })
      .getByRole("button", { name: "Private notes", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Add a private note" })
      .fill("Check the venue before replying");
    await page.getByRole("button", { name: "Add note", exact: true }).click();
    await expect(page.getByText("Check the venue before replying", { exact: true })).toBeVisible();
    await expect(page.getByRole("group", { name: "Demo State Controller" })).not.toBeVisible();
    const selector = page.getByRole("combobox", { name: "Notes conversation" });
    const values = await selector
      .locator("option")
      .evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));
    await selector.selectOption(values[1]);
    await expect(
      page.getByText("Check the venue before replying", { exact: true }),
    ).not.toBeVisible();
    await selector.selectOption(values[0]);
    await expect(page.getByText("Check the venue before replying", { exact: true })).toBeVisible();
  });

  test("keeps routine proof banners hidden and enables configurable warning flags", async ({
    page,
  }) => {
    await expect(page.getByText("Authenticity not verified", { exact: true })).not.toBeVisible();
    await expect(page.getByText("proof unavailable", { exact: true })).not.toBeVisible();
    await openMailboxSettings(page);
    await page.getByRole("tab", { name: "Security", exact: true }).click();
    await page.getByRole("switch", { name: "Show critical mail warnings" }).check();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.locator('[aria-label^="Critical warning:"]').first()).toBeVisible();
    await expect
      .poll(async () =>
        page.evaluate(
          () =>
            JSON.parse(localStorage.getItem("stealth-ui-preferences") ?? "{}").criticalAlerts
              ?.enabled,
        ),
      )
      .toBe(true);
  });

  test("mobile Work navigation and the Personal control stay inside the viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const account = page.getByRole("button", { name: "Account menu" });
    const box = await account.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    await page.getByRole("button", { name: "Work", exact: true }).click();
    await page
      .getByRole("navigation", { name: "Work navigation" })
      .getByRole("button", { name: "Tasks", exact: true })
      .click();
    await expect(page.getByRole("textbox", { name: "Task title" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Bottom navigation" })).not.toBeVisible();
  });
});
