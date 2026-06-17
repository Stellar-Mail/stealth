import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("main mail view has no critical or serious axe violations", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector('[data-stealth-hydrated="true"]');

  await expect(page.getByRole("heading", { name: /inbox/i })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .disableRules(["color-contrast"])
    .analyze();

  const violations = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious",
  );

  expect(violations).toEqual([]);
});

test("compose dialog has no critical or serious axe violations", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector('[data-stealth-hydrated="true"]');

  await page.keyboard.press("Control+n");
  await page.waitForTimeout(300);

  const results = await new AxeBuilder({ page })
    .disableRules(["color-contrast"])
    .analyze();

  const violations = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious",
  );

  expect(violations).toEqual([]);
});

test("settings modal has no critical or serious axe violations", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector('[data-stealth-hydrated="true"]');

  await page.keyboard.press(",");
  await page.waitForTimeout(300);

  const results = await new AxeBuilder({ page })
    .disableRules(["color-contrast"])
    .analyze();

  const violations = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious",
  );

  expect(violations).toEqual([]);
});

test("keyboard shortcuts modal has no critical or serious axe violations", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector('[data-stealth-hydrated="true"]');

  await page.keyboard.press("?");
  await page.waitForTimeout(300);

  const results = await new AxeBuilder({ page })
    .disableRules(["color-contrast"])
    .analyze();

  const violations = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious",
  );

  expect(violations).toEqual([]);
});
