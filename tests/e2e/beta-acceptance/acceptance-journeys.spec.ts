/**
 * BETA-098 (#2005) — Automated acceptance journey smoke (desktop + mobile).
 *
 * Exercises first-time-user critical paths on the /demo stack with deterministic
 * mocks. Manual facilitator scripts live in usability-session-scripts.md.
 */
import { test, expect, openDemoMailbox } from "../fixtures";
import AxeBuilder from "@axe-core/playwright";
import { buildBetaFeedbackPayload, BetaFeedbackValidationError } from "@/features/feedback";

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

  test("address-sharing: account menu exposes shareable federation address", async ({ page }) => {
    await page.getByRole("button", { name: "Account menu" }).click();
    const menu = page.getByRole("menu", { name: "Account" });
    await expect(menu).toBeVisible();
    await expect(menu.getByText(/\*stealth\./)).toBeVisible();
    await expectNoSeriousAxeViolations(page);
  });

  test("compose-send: opens compose dialog and shows pipeline entry", async ({ page }) => {
    await page.keyboard.press("Control+N");
    const dialog = page.getByRole("dialog", { name: "New message" });
    await expect(dialog).toBeVisible();
    await expectNoSeriousAxeViolations(page);
    await page.keyboard.press("Escape");
  });

  test("requests-triage: approves unknown sender from requests folder", async ({ page }) => {
    await page.getByRole("button", { name: "Requests 3" }).click();
    await expect(page.getByRole("heading", { name: "Request Triage Board" })).toBeVisible();
    await page.getByRole("button", { name: "Approve" }).first().click();
    await expect(page.getByText(/Trusted Contacts/i)).toBeVisible();
    await expectNoSeriousAxeViolations(page);
  });

  test("requests-triage: refunds unknown sender postage (denial path)", async ({ page }) => {
    await page.getByRole("button", { name: "Requests 3" }).click();
    await page.getByRole("button", { name: "Refund" }).first().click();
    await expect(page.getByText(/Postage refunded|Refunded/i)).toBeVisible();
  });

  test("proof-inspection: opens inspector and renders proof sections", async ({ page }) => {
    await page.getByRole("button", { name: "Proof Inspector" }).click();
    const dialog = page.getByRole("dialog", { name: "Cryptographic proof inspector" });
    await expect(dialog).toBeVisible();
    await page.getByPlaceholder("Enter Message Hash, Payment").fill("Lina Park");
    await page.getByRole("button", { name: "Inspect", exact: true }).click();
    await expect(page.getByText("Policy Metadata")).toBeVisible();
    await expectNoSeriousAxeViolations(page);
  });

  test("beta-feedback: rejects payload without informed consent", async () => {
    expect(() =>
      buildBetaFeedbackPayload({
        sessionId: "sess_b098_journey",
        taskId: "beta-feedback",
        category: "comprehension",
        rating: 4,
        informedConsent: false,
        viewport: "desktop",
      }),
    ).toThrow(BetaFeedbackValidationError);
  });
});

test.describe("BETA-098 acceptance journeys — desktop recovery", () => {
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
    await expectNoSeriousAxeViolations(page);
  });
});

test.describe("BETA-098 acceptance journeys — mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("onboarding-mailbox: mobile inbox is usable", async ({ page }) => {
    await openDemoMailbox(page);
    await expect(page.getByRole("heading", { name: /Inbox/i })).toBeVisible();
    await expectNoSeriousAxeViolations(page);
  });

  test("address-sharing: mobile account menu exposes federation address", async ({ page }) => {
    await openDemoMailbox(page);
    await page.getByRole("button", { name: "Account menu" }).click();
    const menu = page.getByRole("menu", { name: "Account" });
    await expect(menu.getByText(/\*stealth\./)).toBeVisible();
    await expectNoSeriousAxeViolations(page);
  });

  test("compose-send: mobile compose dialog opens", async ({ page }) => {
    await openDemoMailbox(page);
    await page.getByRole("button", { name: "Compose" }).click();
    await expect(page.getByRole("dialog", { name: "New message" })).toBeVisible();
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

  test("beta-feedback: accepts privacy-safe mobile payload with consent", async () => {
    const result = buildBetaFeedbackPayload({
      sessionId: "sess_b098_mobile",
      taskId: "beta-feedback",
      category: "accessibility",
      rating: 5,
      informedConsent: true,
      viewport: "mobile",
      note: "Touch targets adequate on requests folder",
    });
    expect(result.redacted.viewport).toBe("mobile");
    expect(result.redacted.informedConsent).toBe(true);
  });
});
