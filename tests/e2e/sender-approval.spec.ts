import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";

test.describe("sender approval", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("stealth-preferences", JSON.stringify({ onboardingCompleted: true }));
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.dataset.stealthHydrated === "true");
  });

  async function openRequestsBoard(page: Page) {
    await page.getByRole("button", { name: /^Requests\b/ }).click();
    await expect(page.getByRole("heading", { name: "Request Triage Board" })).toBeVisible();
    await expect(page.getByText("Unknown Sender")).toBeVisible();
  }

  test("approves an unknown sender from the requests folder", async ({ page }) => {
    await openRequestsBoard(page);

    // Approve the sender
    await page.getByRole("button", { name: "Approve" }).first().click();

    // Optimistic state confirms approval
    await expect(page.getByText("Sender Approved")).toBeVisible();
  });

  test("refunds postage for an unknown paid sender", async ({ page }) => {
    await openRequestsBoard(page);

    await page.getByRole("button", { name: "Refund" }).first().click();

    await expect(page.getByText("Postage Refunded")).toBeVisible();
  });
});
