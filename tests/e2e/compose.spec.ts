import { test, expect, openDemoMailbox } from "./fixtures";
import { generateRecipientKeyPair } from "../../src/services/crypto/key-wrap";

// Deterministic Stellar address for the injected demo wallet.
const DEMO_SIGNER = `G${"C".repeat(55)}`;
const RECIPIENT = `G${"B".repeat(55)}`;

let recipientKey: Awaited<ReturnType<typeof generateRecipientKeyPair>>;

function keyDirectoryBody(owner: string, spkiBase64: string) {
  const now = Date.now();
  const notBefore = new Date(now - 60_000).toISOString();
  const notAfter = new Date(now + 86_400_000).toISOString();
  const updatedAt = new Date(now).toISOString();
  const encryptionKey = {
    keyId: "enc-e2e-0001",
    owner,
    algorithm: "x25519",
    purpose: "encryption",
    publicKey: spkiBase64,
    version: 1,
    notBefore,
    notAfter,
    status: "active",
    signature: "e2e",
    createdAt: updatedAt,
    updatedAt,
  };

  return {
    data: {
      owner,
      version: 1,
      updatedAt,
      currentKeys: {
        encryption: encryptionKey,
      },
      historicalKeys: [],
      allKeys: [encryptionKey],
      freshness: {
        resolvedAt: updatedAt,
        cached: false,
        ttlMs: 60_000,
      },
    },
  };
}

test.beforeAll(async () => {
  recipientKey = await generateRecipientKeyPair();
});

test.describe("compose flow", () => {
  // E2E runs in a headless browser with no Freighter extension and no live
  // relay. Install a deterministic wallet stub (read by the wallet seam in
  // src/services/stellar/wallet.ts) and stub relay discovery, the relay accept
  // endpoint, and the recipient key directory so the full send pipeline can
  // complete end to end.
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

    await page.route("**/api/v1/identity/resolve*", (route) => {
      const url = new URL(route.request().url());
      const identifier = (url.searchParams.get("identifier") ?? "").toUpperCase();
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            resolved: true,
            status: "active",
            canonicalAddress: identifier,
            account: identifier,
            publicKey: identifier,
            freshness: {
              source: "live",
              cached: false,
              expiresAt: new Date(Date.now() + 60000).toISOString(),
            },
          },
        }),
      });
    });

    await page.route("**/api/v1/identity/keys/**", (route) => {
      const url = new URL(route.request().url());
      const owner = (url.searchParams.get("owner") ?? "").toUpperCase();
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(keyDirectoryBody(owner, recipientKey.publicKeySpkiBase64)),
      });
    });

    await openDemoMailbox(page);
  });

  test("opens compose, fills fields, and sends message", async ({ page }) => {
    await page.getByRole("complementary").getByRole("button", { name: "Compose Ctrl+N" }).click();
    await expect(page.getByText("New message")).toBeVisible();

    await page.getByPlaceholder("recipients@", { exact: false }).fill(RECIPIENT);
    await page.getByPlaceholder("Subject").fill("E2E test subject");
    await page.getByPlaceholder("Write your message", { exact: false }).fill("Hello from E2E test");
    await expect(page.getByText(RECIPIENT)).toBeVisible();

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

  test("prevents sending if recipient encryption key is revoked", async ({ page }) => {
    const REVOKED_RECIPIENT = `G${"D".repeat(55)}`;
    await page.route("**/api/v1/identity/keys/**", (route) => {
      const url = new URL(route.request().url());
      const owner = (url.searchParams.get("owner") ?? "").toUpperCase();
      if (owner === REVOKED_RECIPIENT) {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              owner: REVOKED_RECIPIENT,
              version: 1,
              currentKeys: {
                encryption: {
                  keyId: "enc-e2e-0002",
                  algorithm: "ecdh",
                  publicKey: recipientKey.publicKeySpkiBase64,
                  version: 1,
                  notBefore: new Date(Date.now() - 60_000).toISOString(),
                  notAfter: new Date(Date.now() + 86_400_000).toISOString(),
                  status: "revoked",
                  signature: "e2e",
                },
              },
              historicalKeys: [],
              allKeys: [],
            },
          }),
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(keyDirectoryBody(owner, recipientKey.publicKeySpkiBase64)),
        });
      }
    });

    await page.getByRole("complementary").getByRole("button", { name: "Compose Ctrl+N" }).click();
    await expect(page.getByText("New message")).toBeVisible();

    await page.getByPlaceholder("recipients@", { exact: false }).fill(REVOKED_RECIPIENT);
    await page.getByPlaceholder("Subject").fill("E2E revoked key test");
    await page.getByPlaceholder("Write your message", { exact: false }).fill("Should be blocked");

    // Wait for the chip to show the key revoked status
    await expect(page.getByText("key revoked")).toBeVisible();

    // Check that button is blocked/disabled
    const sendBtn = page.getByRole("button", {
      name: /Recipient has blocked this sender or key is revoked/i,
    });
    await expect(sendBtn).toBeDisabled();
  });
});
