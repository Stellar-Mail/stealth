import { test, expect } from "@playwright/test";

test.describe("App Bootstrap & Failure Recovery Journey", () => {
  test("redirects anonymous visitors to sign-in with a validated return-to when bootstrap returns 401", async ({
    page,
  }) => {
    await page.route("**/api/v1/bootstrap", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          error: {
            code: "unauthorized",
            message: "Your session has expired. Please sign in again.",
          },
          branch: "unauthorized",
        }),
      });
    });

    await page.goto("/mail/123?tab=preview");
    await expect(page).toHaveURL(/\/auth\/sign-in/, { timeout: 60000 });
    const redirected = new URL(page.url());
    expect(redirected.searchParams.get("next")).toBe("/mail/123?tab=preview");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible({
      timeout: 60000,
    });
  });

  test("never lands an anonymous visitor on demo data in production mode", async ({ page }) => {
    await page.route("**/api/v1/bootstrap", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          error: { code: "unauthorized", message: "No session." },
          branch: "unauthorized",
        }),
      });
    });

    await page.goto("/demo");
    await expect(page).toHaveURL(/\/auth\/sign-in/, { timeout: 60000 });
    await expect(page.getByText(/Demo Mode/i)).toHaveCount(0);
  });

  test("renders service outage branch and recovers via retry button", async ({ page }) => {
    let attempt = 0;

    await page.route("**/api/v1/bootstrap", async (route) => {
      attempt++;
      if (attempt === 1) {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            ok: false,
            error: { code: "server_error", message: "Service temporarily unavailable." },
            branch: "outage",
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            data: {
              user: {
                userId: "user_e2e",
                username: "e2euser",
                displayName: "E2E User",
                email: "e2e@stealth.mail",
                accountStatus: "active",
                createdAt: new Date().toISOString(),
              },
              session: {
                sessionId: "sess_e2e",
                expiresAt: new Date(Date.now() + 3600000).toISOString(),
              },
              address: "user_e2e",
              provisioning: null,
              policy: null,
              wallet: {
                connected: true,
                address: "user_e2e",
                signerType: "managed",
                capabilities: ["sign", "send", "read"],
                network: "testnet",
                balanceXlm: "100.0000000",
              },
              health: {
                ready: true,
                status: "ok",
                dependencies: { bindings: "ok" },
              },
              syncCursor: "sync_e2e",
              featureFlags: {},
              branch: "active",
            },
          }),
        });
      }
    });

    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Service temporarily unavailable" }),
    ).toBeVisible({ timeout: 60000 });

    const retryButton = page.getByRole("button", { name: /Retry connection/i });
    await expect(retryButton).toBeVisible();
    await retryButton.click();

    // Upon retry, active branch loads
    await expect(
      page.getByRole("heading", { name: "Service temporarily unavailable" }),
    ).toBeHidden();
  });
});
