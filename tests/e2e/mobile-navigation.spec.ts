import { test, expect, openDemoMailbox } from "./fixtures";

// Drive the navigation surface at a phone-sized viewport so the mobile bottom
// bar is the active navigation affordance and the desktop sidebar is collapsed
// out of the layout by its `hidden md:flex` class.
test.use({ viewport: { width: 390, height: 844 } });

test.describe("mobile navigation", () => {
  test.beforeEach(async ({ page }) => {
    await openDemoMailbox(page);
  });

  test("shows the bottom bar and hides the desktop sidebar on small screens", async ({ page }) => {
    const bottomNav = page.getByRole("navigation", { name: "Bottom navigation" });
    await expect(bottomNav).toBeVisible();
    await expect(bottomNav.getByRole("button", { name: "Inbox" })).toBeVisible();

    // The desktop sidebar's Compose button (labelled with its Ctrl+N hint) is
    // part of the `hidden md:flex` sidebar, so it must not be visible on mobile.
    await expect(page.getByRole("button", { name: "Compose Ctrl+N" })).toBeHidden();
  });

  test("tapping a folder tab switches the mailbox folder (success path)", async ({ page }) => {
    const bottomNav = page.getByRole("navigation", { name: "Bottom navigation" });

    await bottomNav.getByRole("button", { name: "Proofs" }).click();
    await expect(page.getByRole("heading", { name: "Pending Proof" })).toBeVisible();
    await expect(bottomNav.getByRole("button", { name: "Proofs" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await bottomNav.getByRole("button", { name: "Inbox" }).click();
    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
    await expect(bottomNav.getByRole("button", { name: "Inbox" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("action-only tabs never mark themselves active (edge path)", async ({ page }) => {
    const bottomNav = page.getByRole("navigation", { name: "Bottom navigation" });

    // Compose opens the composer but must not become an active folder tab.
    await bottomNav.getByRole("button", { name: "Compose" }).click();
    await expect(page.getByText("New message")).toBeVisible();
    await expect(bottomNav.getByRole("button", { name: "Compose" })).not.toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
