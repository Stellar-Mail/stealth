import { test, expect, openDemoMailbox } from "./fixtures";
import { generateRecipientKeyPair } from "../../src/services/crypto/key-wrap";

// Deterministic Stellar address for the injected demo wallet.
const DEMO_SIGNER = `G${"C".repeat(55)}`;
const ALICE = `G${"B".repeat(55)}`;
const BOB = `G${"D".repeat(55)}`;

let aliceKey: Awaited<ReturnType<typeof generateRecipientKeyPair>>;
let bobKey: Awaited<ReturnType<typeof generateRecipientKeyPair>>;

function keyDirectoryBody(owner: string, spkiBase64: string) {
  const now = Date.now();
  return {
    data: {
      owner,
      version: 1,
      currentKeys: {
        encryption: {
          keyId: "enc-e2e-0001",
          algorithm: "ecdh",
          publicKey: spkiBase64,
          version: 1,
          notBefore: new Date(now - 60_000).toISOString(),
          notAfter: new Date(now + 86_400_000).toISOString(),
          status: "active",
          signature: "e2e",
        },
      },
      historicalKeys: [],
      allKeys: [],
    },
  };
}

test.beforeAll(async () => {
  aliceKey = await generateRecipientKeyPair();
  bobKey = await generateRecipientKeyPair();
});

test.describe("send pipeline", () => {
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

    await page.route("**/relays/mock/messages", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
    );

    await page.route("**/api/v1/identity/keys/**", (route) => {
      const url = new URL(route.request().url());
      const owner = (url.searchParams.get("owner") ?? "").toUpperCase();
      const spki = owner === ALICE ? aliceKey.publicKeySpkiBase64 : bobKey.publicKeySpkiBase64;
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(keyDirectoryBody(owner, spki)),
      });
    });

    await openDemoMailbox(page);
  });

  test("seals, signs, and submits to the relay for two recipients with Unicode body", async ({
    page,
  }) => {
    await page.getByRole("complementary").getByRole("button", { name: "Compose Ctrl+N" }).click();
    await expect(page.getByText("New message")).toBeVisible();

    await page.getByPlaceholder("recipients@", { exact: false }).fill(`${ALICE}, ${BOB}`);
    await page.getByPlaceholder("Subject").fill("Two-recipient pipeline");
    await page
      .getByPlaceholder("Write your message", { exact: false })
      .fill("Hello Bob — Grüße π ≈ 3.14 ✓ 安全的");
    await expect(page.getByText(ALICE)).toBeVisible();
    await expect(page.getByText(BOB)).toBeVisible();

    await page.getByRole("button", { name: "Send", exact: true }).click();

    await expect(page.getByText("New message")).not.toBeVisible();
    await expect(page.getByText(/Encrypted message sent/i)).toBeVisible();
  });

  test("shows a recoverable error when a recipient key is missing", async ({ page }) => {
    // Drop the key-directory stub for one recipient so its keys cannot resolve.
    await page.unroute("**/api/v1/identity/keys/**");
    await page.route("**/api/v1/identity/keys/**", (route) => {
      const url = new URL(route.request().url());
      const owner = (url.searchParams.get("owner") ?? "").toUpperCase();
      if (owner === ALICE) {
        route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
      } else {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(keyDirectoryBody(owner, bobKey.publicKeySpkiBase64)),
        });
      }
    });

    await page.getByRole("complementary").getByRole("button", { name: "Compose Ctrl+N" }).click();
    await page.getByPlaceholder("recipients@", { exact: false }).fill(`${ALICE}, ${BOB}`);
    await page.getByPlaceholder("Subject").fill("Missing key");
    await page
      .getByPlaceholder("Write your message", { exact: false })
      .fill("This should not send");
    await page.getByRole("button", { name: "Send", exact: true }).click();

    await expect(page.getByText("New message")).toBeVisible();
    await expect(page.getByText(/Send failed/i)).toBeVisible();
  });
});
