import { test, expect, openDemoMailbox } from "../fixtures";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Workflow 3 (BETA-075) — Accessibility (WCAG 2.1 A/AA) Audit
// ---------------------------------------------------------------------------

async function expectNoSeriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const violations = results.violations.filter(
    (violation) => violation.impact === "critical" || violation.impact === "serious",
  );
  expect(violations).toHaveLength(0);
}

test.describe("Workflow 3 — Accessibility Audits", () => {
  test("main mailbox shell passes WCAG 2.1 A/AA audit", async ({ page }) => {
    await openDemoMailbox(page);
    await expectNoSeriousViolations(page);
  });

  test("composer modal passes WCAG 2.1 A/AA audit with keyboard navigation", async ({ page }) => {
    await openDemoMailbox(page);

    // Open compose modal
    await page.getByRole("complementary").getByRole("button", { name: "Compose Ctrl+N" }).click();
    await expect(page.getByText("New message")).toBeVisible();

    // Verify accessible interactive elements
    await expectNoSeriousViolations(page);

    // Tab through fields
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBeTruthy();
  });

  test("settings dialog passes WCAG 2.1 A/AA audit", async ({ page }) => {
    await openDemoMailbox(page);

    await page.getByRole("button", { name: "Settings" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    // Wait for the open animation to finish so axe does not sample translucent frames.
    await expect(dialog).toHaveCSS("opacity", "1");
    await expect(page.getByRole("button", { name: "Save changes" })).toBeVisible();

    await expectNoSeriousViolations(page);
  });
});
