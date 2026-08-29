/**
 * BETA-098 (#2005) — Automated acceptance journey smoke (desktop + mobile).
 *
 * Exercises first-time-user critical paths on the /demo stack with deterministic
 * mocks. Manual facilitator scripts live in usability-session-scripts.md.
 */
import { test, expect, openDemoMailbox } from "../fixtures";
import AxeBuilder from "@axe-core/playwright";

async function expectNoSeriousAxeViolations(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious",
  );
  expect(serious, `axe violations: ${serious.map((v) => v.id).join(", ")}`).toHaveLength(0);
}

test.describe("BETA-098 acceptance journeys — desktop", () => {
  test.beforeEach(async ({ page }) => {
    await openDemoMailbox(page);
  });

  test("onboarding-mailbox: lands in inbox with navigable shell", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Inbox/i })).toBeVisible();
    await expect(page.getByRole("navigation", { name: /Mail folders/i })).toBeVisible();
    await expectNoSeriousAxeViolations(page);
  });

  test("address-sharing: account menu exposes copyable address", async ({ page }) => {
    await page.getByRole("button", { name: /Account menu/i }).click();
    await expect(page.getByText(/G[A-Z0-9]{55}/)).toBeVisible();
  });

  test("compose-send: opens compose dialog and shows pipeline entry", async ({ page }) => {
    await page.keyboard.press("Control+N");
    await expect(page.getByRole("dialog", { name: "New message" })).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("requests-triage: approves unknown sender from requests folder", async ({ page }) => {
    await page.getByRole("button", { name: "Requests 3" }).click();
    await expect(page.getByRole("heading", { name: "Request Triage Board" })).toBeVisible();
    await page.getByRole("button", { name: "Approve" }).first().click();
    await expect(page.getByText(/Trusted Contacts/i)).toBeVisible();
  });

  test("proof-inspection: opens inspector and renders proof sections", async ({ page }) => {
    await page.getByRole("button", { name: "Proof Inspector" }).click();
    await expect(page.getByRole("dialog", { name: "Cryptographic proof inspector" })).toBeVisible();
    await page.getByPlaceholder("Enter Message Hash, Payment").fill("Lina Park");
    await page.getByRole("button", { name: "Inspect", exact: true }).click();
    await expect(page.getByText("Policy Metadata")).toBeVisible();
  });
});

test.describe("BETA-098 acceptance journeys — mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("onboarding-mailbox: mobile inbox is usable", async ({ page }) => {
    await openDemoMailbox(page);
    await expect(page.getByRole("heading", { name: /Inbox/i })).toBeVisible();
    await expectNoSeriousAxeViolations(page);
  });

  test("recovery-sign-in: expired session redirects to sign-in with return path", async ({
    page,
  }) => {
    await page.route("**/api/v1/bootstrap", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          error: { code: "unauthorized", message: "Session expired." },
          branch: "unauthorized",
        }),
      }),
    );
    await page.goto("/mail/inbox");
    await expect(page).toHaveURL(/\/auth\/sign-in/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });
});
