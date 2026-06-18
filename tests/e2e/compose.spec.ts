import { test, expect, openDemoMailbox } from "./fixtures";

// Deterministic Stellar address for the injected demo wallet.
const DEMO_SIGNER = `G${"C".repeat(55)}`;

test.describe("compose flow", () => {
  // E2E runs in a headless browser with no Freighter extension and no live
  // relay. Install a deterministic wallet stub (read by the wallet seam in
  // src/services/stellar/wallet.ts) and stub relay discovery so the full send
  // pipeline can complete end to end.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((signer) => {
      Object.defineProperty(window, "__freighterApi", {
        configurable: true,
        value: {
          isConnected: () => Promise.resolve({ isConnected: true }),
          requestAccess: () => Promise.resolve({ address: signer }),
          signMessage: () =>
            Promise.resolve({
              signedMessage: "e2e-mock-signature",
              signerAddress: signer,
            }),
        },
      });
    }, DEMO_SIGNER);

    await page.route("**/relays/*/diagnostics", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "healthy",
          endpoint: "/relays/mock/messages",
          publicKey: DEMO_SIGNER,
        }),
      }),
    );

    await openDemoMailbox(page);
  });

  test("opens compose, fills fields, and sends message", async ({ page }) => {
    await page.getByRole("complementary").getByRole("button", { name: "Compose Ctrl+N" }).click();
    await expect(page.getByText("New message")).toBeVisible();

    await page.getByPlaceholder("recipients@", { exact: false }).fill("alice*stellar.org");
    await page.getByPlaceholder("Subject").fill("E2E test subject");
    await page.getByPlaceholder("Write your message", { exact: false }).fill("Hello from E2E test");
    await expect(page.getByText("alice*stellar.org")).toBeVisible();

    await page.getByRole("button", { name: "Send", exact: true }).click();

    await expect(page.getByText("New message")).not.toBeVisible();
    await expect(page.getByText(/Encrypted message sent/i)).toBeVisible();
  });

  test("validates required fields before sending", async ({ page }) => {
    await page.getByRole("complementary").getByRole("button", { name: "Compose Ctrl+N" }).click();
    await expect(page.getByText("New message")).toBeVisible();

    await page.getByRole("button", { name: "Send", exact: true }).click();

    await expect(page.getByText("New message")).toBeVisible();
    await expect(page.getByText(/Please add at least one recipient/i)).toBeVisible();
  });

  test("schedules message instead of immediate send", async ({ page }) => {
    await page.getByRole("complementary").getByRole("button", { name: "Compose Ctrl+N" }).click();
    await expect(page.getByText("New message")).toBeVisible();

    await page.getByPlaceholder("recipients@", { exact: false }).fill("bob*stellar.org");
    await page.getByPlaceholder("Subject").fill("Scheduled message");
    await page.getByPlaceholder("Write your message", { exact: false }).fill("Sent later");
    await expect(page.getByText("bob*stellar.org")).toBeVisible();

    await page.getByRole("button", { name: "Schedule", exact: true }).click();

    await expect(page.getByText("New message")).not.toBeVisible();
    await expect(page.getByText(/Message scheduled with postage reserved/i)).toBeVisible();
  });
});
