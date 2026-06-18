import { test, expect, openDemoMailbox } from "./fixtures";

test.describe("sender approval", () => {
  test.beforeEach(async ({ page }) => {
    await openDemoMailbox(page);
  });

  test("approves an unknown sender from the requests folder", async ({ page }) => {
    await page.getByRole("button", { name: "Requests 3" }).click();
    await expect(page.getByRole("heading", { name: "Request Triage Board" })).toBeVisible();

    const approveButtons = page.getByRole("button", { name: "Approve" });
    await expect(approveButtons).toHaveCount(3);
    await approveButtons.first().click();

    await expect(
      page.getByText(/Unknown Sender added to Trusted Contacts\. Mail moved to Inbox\./i),
    ).toBeVisible();
  });

  test("blocks an unknown sender and queues postage refund", async ({ page }) => {
    await page.getByRole("button", { name: "Requests 3" }).click();
    await expect(page.getByRole("heading", { name: "Request Triage Board" })).toBeVisible();

    const refundButtons = page.getByRole("button", { name: "Refund" });
    await expect(refundButtons).toHaveCount(3);
    await refundButtons.first().click();

    await expect(
      page.getByText(/Postage refunded for message from Unknown Sender\./i),
    ).toBeVisible();
  });
});
