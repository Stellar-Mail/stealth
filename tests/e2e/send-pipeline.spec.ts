import { test, expect, openDemoMailbox } from "./fixtures";
import { generateRecipientKeyPair } from "../../src/services/crypto/key-wrap";

// Deterministic Stellar address for the injected demo wallet.
const DEMO_SIGNER = `G${"C".repeat(55)}`;
const ALICE = `G${"B".repeat(55)}`;
const BOB = `G${"D".repeat(55)}`;
const SEND_BUTTON_NAME = /^Send(?: \+ .* XLM| free)?$/;

let aliceKey: Awaited<ReturnType<typeof generateRecipientKeyPair>>;
let bobKey: Awaited<ReturnType<typeof generateRecipientKeyPair>>;

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

    await page.route("**/relays/**/diagnostics", (route) =>
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

    await page.route("**/api/v1/relay/messages", (route) =>
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
      .fill("Hello Bob \u2014 Gr\u00fc\u00dfe \u03c0 \u2248 3.14 \u2713 \u5b89\u5168\u7684");
    await expect(page.getByText(ALICE)).toBeVisible();
    await expect(page.getByText(BOB)).toBeVisible();

    const sendBtn = page.getByRole("button", { name: "Send", exact: true });
    await expect(sendBtn).toBeEnabled();
    await sendBtn.click();

    await expect(page.getByText("New message")).not.toBeVisible();
    await expect(page.getByText(/Encrypted message sent/i)).toBeVisible();
  });

  test("shows a recoverable error when a recipient key is missing, allows inspecting failure details", async ({
    page,
  }) => {
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
    const sendBtn = page.getByRole("button", { name: "Send", exact: true });
    await expect(sendBtn).toBeEnabled();
    await sendBtn.click();

    await expect(page.getByText("New message")).toBeVisible();
    await expect(page.getByText(/Send failed/i)).toBeVisible();

    // Inspect failure details
    const inspectBtn = page.getByRole("button", { name: /inspect failure/i });
    if (await inspectBtn.isVisible()) {
      await inspectBtn.click();
      await expect(page.getByText(/Failed Stage:/i)).toBeVisible();
      await expect(page.getByText("resolve", { exact: true })).toBeVisible();
    }
  });

  test("double clicking Send does not duplicate relay submissions", async ({ page }) => {
    let submissionCount = 0;
    const handleRelayRoute = async (route: import("@playwright/test").Route) => {
      submissionCount += 1;
      // Delay response slightly to simulate real network request
      await new Promise((r) => setTimeout(r, 100));
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    };
    await page.unroute("**/relays/mock/messages");
    await page.unroute("**/api/v1/relay/messages");
    await page.route("**/relays/mock/messages", handleRelayRoute);
    await page.route("**/api/v1/relay/messages", handleRelayRoute);

    await page.getByRole("complementary").getByRole("button", { name: "Compose Ctrl+N" }).click();
    await page.getByPlaceholder("recipients@", { exact: false }).fill(ALICE);
    await page.getByPlaceholder("Subject").fill("Double click test");
    await page.getByPlaceholder("Write your message", { exact: false }).fill("One submit only");

    const sendBtn = page.getByRole("button", { name: "Send", exact: true });
    await expect(sendBtn).toBeEnabled();
    // Double click rapidly
    await sendBtn.dblclick();

    await expect(page.getByText("New message")).not.toBeVisible();
    await expect(page.getByText(/Encrypted message sent/i)).toBeVisible();
    expect(submissionCount).toBe(1);
  });
});
