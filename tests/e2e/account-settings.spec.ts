import { test, expect, openDemoMailbox } from "./fixtures";

test.describe("Account Settings", () => {
  // Mutable display-name used by the route mock across GET / PATCH cycles.
  let currentDisplayName = "Alice User";

  test.beforeEach(async ({ page }) => {
    currentDisplayName = "Alice User";

    // Register the API mock *before* navigation so it is ready for any
    // requests that fire during the initial page load.  This also avoids
    // the CI-only flake where `page.route()` registered after navigation
    // could collide with Vite module loading on slow runners.
    await page.route("**/api/v1/accounts/profile", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          json: {
            data: {
              account: {
                email: "alice@stealth.test",
                address: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
                status: "active",
                network: "testnet",
                createdAt: new Date().toISOString(),
                betaLimitations: [],
              },
              profile: {
                displayName: currentDisplayName,
                username: "alice",
                locale: "en",
                timezone: "UTC",
                addressDisplay: "truncated",
                updatedAt: new Date().toISOString(),
              },
            },
            meta: { requestId: "mock_req", timestamp: new Date().toISOString() },
          },
        });
      } else if (route.request().method() === "PATCH") {
        const body = JSON.parse(route.request().postData() || "{}");
        if (body.displayName) {
          currentDisplayName = body.displayName;
        }
        await route.fulfill({
          status: 200,
          json: {
            data: { success: true },
            meta: { requestId: "mock_req2", timestamp: new Date().toISOString() },
          },
        });
      } else {
        await route.continue();
      }
    });

    await openDemoMailbox(page);
  });

  test("can view and update profile settings", async ({ page }) => {
    // Open Settings modal
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

    // Verify initial profile data is loaded
    await expect(page.getByText("Alice User").first()).toBeVisible();
    await expect(page.getByText("alice@stealth.test").first()).toBeVisible();

    // Edit display name
    await page.getByRole("button", { name: "Edit Display name" }).click();
    const displayNameInput = page.getByRole("dialog", { name: "Settings" }).getByRole("textbox");
    await displayNameInput.fill("Alice Updated");
    await page.getByRole("button", { name: "Save", exact: true }).click();

    // Verify optimistic update / persistence
    await expect(page.getByText("Alice Updated").first()).toBeVisible();

    // Check identifiers section
    await expect(
      page.getByLabel("Email changes require identity verification (not yet available)"),
    ).toBeVisible();
    await expect(page.getByLabel("Usernames cannot be changed")).toBeVisible();
    await expect(page.getByLabel("Immutable").first()).toBeVisible();
  });
});
