import { expect, test } from "@playwright/test";

// ---------------------------------------------------------------------------
// BETA-013 (Issue #1920) — profile-first onboarding.
//
// The onboarding API is stubbed with page.route so the wizard can be exercised
// without constructing a real session; the flow under test is the client-side
// wizard: profile-first steps, no wallet anywhere, restore / resume, and
// idempotent completion.
// ---------------------------------------------------------------------------

const MAILBOX_ADDRESS = `G${"A".repeat(55)}`;

const DRAFT_PROJECTION = {
  status: "in_progress",
  step: "profile",
  displayName: "",
  recoveryAcknowledged: false,
  unknownSenderRule: "request",
  minimumPostage: "0",
  receiptOnDelivery: false,
  updatedAt: new Date().toISOString(),
  completedAt: null,
};

function bootstrapBody(onboarding = DRAFT_PROJECTION) {
  return {
    data: {
      user: {
        userId: "e2e_onboard_user",
        username: "e2e_onboard_user",
        displayName: "E2E User",
        email: "e2e@stealth.mail",
        accountStatus: "active",
        createdAt: new Date().toISOString(),
      },
      session: {
        sessionId: "sess_e2e_onboarding",
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      },
      address: MAILBOX_ADDRESS,
      provisioning: null,
      onboarding,
      policy: null,
      wallet: {
        connected: true,
        address: MAILBOX_ADDRESS,
        signerType: "managed",
        capabilities: ["sign"],
        network: "testnet",
        balanceXlm: "100.0000000",
      },
      health: { ready: true, status: "ok", dependencies: { bindings: "ok" } },
      syncCursor: `sync_${Date.now()}`,
      featureFlags: { betaStateMachines: true, sorobanPostage: true, liveMailboxSync: true },
      branch: "active",
    },
  };
}

function wireOnboardingApi(page: import("@playwright/test").Page) {
  const savedDrafts: unknown[] = [];
  const completeCalls: unknown[] = [];

  page.route("**/api/v1/bootstrap", async (route) => {
    await route.fulfill({ json: bootstrapBody() });
  });

  page.route("**/api/v1/onboarding/draft", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: { data: { draft: DRAFT_PROJECTION } } });
      return;
    }
    const payload = route.request().postDataJSON();
    savedDrafts.push(payload);
    await route.fulfill({ json: { data: { draft: payload.draft } } });
  });

  page.route("**/api/v1/onboarding/complete", async (route) => {
    const payload = route.request().postDataJSON();
    completeCalls.push(payload);
    await route.fulfill({
      json: {
        data: {
          alreadyCompleted: false,
          draft: { ...DRAFT_PROJECTION, status: "completed", step: "review" },
          policy: {
            allowUnknown: true,
            requireVerified: false,
            minimumPostage: "0",
            requireReceipt: false,
          },
        },
      },
    });
  });

  return { savedDrafts, completeCalls };
}

async function walkThroughRecovery(page: import("@playwright/test").Page) {
  await expect(page.getByRole("heading", { name: "Secure your recovery" })).toBeVisible();
  await page.getByRole("button", { name: /I have secured access to my account recovery/i }).click();
  await page.getByRole("button", { name: /I understand that losing recovery access/i }).click();
  await page.getByRole("button", { name: "Continue" }).click();
}

test.describe("profile-first onboarding wizard", () => {
  test("completes the full flow without a wallet and never sends a wallet address", async ({
    page,
  }) => {
    const { savedDrafts, completeCalls } = wireOnboardingApi(page);

    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Your profile" })).toBeVisible({
      timeout: 60000,
    });

    const displayName = page.getByLabel("Display name");
    await displayName.fill("Ada Lovelace");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { name: "Your mailbox address" })).toBeVisible();
    await expect(page.getByText(MAILBOX_ADDRESS)).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();

    await walkThroughRecovery(page);

    await expect(page.getByRole("heading", { name: "Who can mail you?" })).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { name: "Set minimum postage" })).toBeVisible();
    await page.getByRole("button", { name: /0\.01 XLM/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { name: "Delivery receipts" })).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { name: "Review your mailbox policy" })).toBeVisible();
    await page.getByRole("button", { name: "Activate mailbox" }).click();

    await expect(page.getByRole("heading", { name: "You're all set" })).toBeVisible({
      timeout: 60000,
    });

    for (const draft of savedDrafts) {
      expect(draft).not.toHaveProperty("walletAddress");
    }
    expect(completeCalls.length).toBe(1);
    expect(completeCalls[0]).not.toHaveProperty("walletAddress");
    expect(completeCalls[0]).toMatchObject({
      draft: { displayName: "Ada Lovelace", minimumPostage: "0.01" },
    });
  });

  test("resumes a saved draft on refresh (server-backed, no localStorage)", async ({ page }) => {
    const resumedDraft = {
      ...DRAFT_PROJECTION,
      step: "receipts",
      displayName: "Grace Hopper",
      recoveryAcknowledged: true,
      unknownSenderRule: "verified",
      minimumPostage: "0.001",
    };

    page.route("**/api/v1/bootstrap", async (route) => {
      await route.fulfill({ json: bootstrapBody(resumedDraft) });
    });
    page.route("**/api/v1/onboarding/draft", async (route) => {
      await route.fulfill({ json: { data: { draft: resumedDraft } } });
    });

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Delivery receipts" })).toBeVisible({
      timeout: 60000,
    });
    await expect(page.getByRole("button", { name: /No receipts/, pressed: true })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("stealth-onboarding-v1"))).toBeNull();
  });

  test("duplicate submit is harmless (idempotent completion)", async ({ page }) => {
    page.route("**/api/v1/bootstrap", async (route) => {
      await route.fulfill({ json: bootstrapBody() });
    });
    page.route("**/api/v1/onboarding/draft", async (route) => {
      await route.fulfill({ json: { data: { draft: DRAFT_PROJECTION } } });
    });

    let uniqueCompletions = 0;
    const replayedKeys = new Set<string>();
    page.route("**/api/v1/onboarding/complete", async (route) => {
      const key = route.request().headers()["x-idempotency-key"];
      if (key && replayedKeys.has(key)) {
        await route.fulfill({
          headers: { "x-idempotency-replayed": "true" },
          json: {
            data: {
              alreadyCompleted: true,
              draft: { ...DRAFT_PROJECTION, status: "completed", step: "review" },
              policy: {
                allowUnknown: true,
                requireVerified: false,
                minimumPostage: "0",
                requireReceipt: false,
              },
            },
          },
        });
        return;
      }
      uniqueCompletions += 1;
      if (key) replayedKeys.add(key);
      await route.fulfill({
        json: {
          data: {
            alreadyCompleted: false,
            draft: { ...DRAFT_PROJECTION, status: "completed", step: "review" },
            policy: {
              allowUnknown: true,
              requireVerified: false,
              minimumPostage: "0",
              requireReceipt: false,
            },
          },
        },
      });
    });

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Your profile" })).toBeVisible({
      timeout: 60000,
    });
    await page.getByLabel("Display name").fill("Ada");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { name: "Secure your recovery" })).toBeVisible();
    await page
      .getByRole("button", { name: /I have secured access to my account recovery/i })
      .click();
    await page.getByRole("button", { name: /I understand that losing recovery access/i }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    const activate = page.getByRole("button", { name: "Activate mailbox" });
    await activate.dblclick();

    await expect(page.getByRole("heading", { name: "You're all set" })).toBeVisible({
      timeout: 60000,
    });
    expect(uniqueCompletions).toBe(1);
  });
});
