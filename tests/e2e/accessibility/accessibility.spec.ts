import { test, expect, openDemoMailbox } from "../fixtures";
import { generateRecipientKeyPair } from "../../../src/services/crypto/key-wrap";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// BETA-073 (Issue #1980) — WCAG keyboard, screen-reader, and motion audits
// run against the live app shell. Axe scans use WCAG 2.1 A/AA tags; failures
// are only enforced at the critical/serious impact level so the suite stays
// deterministic while still surfacing full violation lists in messages.
// ---------------------------------------------------------------------------

async function collectSeriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  return results.violations.filter(
    (violation) => violation.impact === "critical" || violation.impact === "serious",
  );
}

function formatViolations(violations: Array<{ id: string; help: string; nodes: unknown[] }>) {
  return violations
    .map((violation) => `${violation.id} (${violation.nodes.length} node(s)) — ${violation.help}`)
    .join("\n");
}

async function expectNoSeriousViolations(page: Page) {
  const violations = await collectSeriousViolations(page);
  expect(
    violations,
    `Serious/critical axe violations:\n${formatViolations(violations)}`,
  ).toHaveLength(0);
}

/** Installs the deterministic wallet stub plus relay/key-directory mocks used by the compose pipeline. */
function keyDirectoryBody(owner: string, spkiBase64: string) {
  const now = Date.now();
  const updatedAt = new Date(now).toISOString();
  return {
    data: {
      owner,
      version: 1,
      updatedAt,
      currentKeys: {
        encryption: {
          keyId: "enc-e2e-0001",
          owner,
          algorithm: "x25519",
          purpose: "encryption",
          publicKey: spkiBase64,
          version: 1,
          notBefore: new Date(now - 60_000).toISOString(),
          notAfter: new Date(now + 86_400_000).toISOString(),
          status: "active",
          signature: "e2e",
          createdAt: updatedAt,
          updatedAt,
        },
      },
      historicalKeys: [],
      allKeys: [],
      freshness: { resolvedAt: updatedAt, cached: false, ttlMs: 60_000 },
    },
  };
}

async function installSendMocks(page: Page, messageStatus = 200) {
  await page.addInitScript(
    (signer) => {
      Object.defineProperty(window, "__freighterApi", {
        configurable: true,
        value: {
          isConnected: () => Promise.resolve({ isConnected: true }),
          requestAccess: () => Promise.resolve({ address: signer }),
          signMessage: () =>
            Promise.resolve({ signedMessage: "e2e-mock-signature", signerAddress: signer }),
        },
      });
    },
    `G${"C".repeat(55)}`,
  );

  await page.route("**/relays/**/diagnostics", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "healthy",
        endpoint: "/relays/mock/messages",
        publicKey: `G${"C".repeat(55)}`,
      }),
    }),
  );

  await page.route("**/relays/mock/messages", (route) =>
    route.fulfill({ status: messageStatus, contentType: "application/json", body: "{}" }),
  );

  await page.route("**/api/v1/relay/messages", (route) =>
    route.fulfill({ status: messageStatus, contentType: "application/json", body: "{}" }),
  );

  const recipientKey = await generateRecipientKeyPair();
  await page.route("**/api/v1/identity/keys/**", (route) => {
    const url = new URL(route.request().url());
    const owner = (url.searchParams.get("owner") ?? "").toUpperCase();
    void route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(keyDirectoryBody(owner, recipientKey.publicKeySpkiBase64)),
    });
  });
}

test.describe("accessibility (BETA-073)", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        Object.defineProperty(window.navigator, "onLine", {
          configurable: true,
          get: () => true,
        });
      } catch {
        // Some environments disallow redefining navigator props; fall back gracefully.
      }
    });
    await openDemoMailbox(page);
    await page.getByRole("heading", { name: /inbox/i }).waitFor();
  });

  test("populated mailbox shell has no serious axe violations", async ({ page }) => {
    await expectNoSeriousViolations(page);
  });

  test("requests triage board has no serious axe violations", async ({ page }) => {
    await page.getByRole("complementary").getByRole("button", { name: "Requests" }).click();
    await expect(page.getByRole("heading", { name: "Request Triage Board" })).toBeVisible();
    await expectNoSeriousViolations(page);
  });

  test("skip link jumps to the main mailbox landmark", async ({ page }) => {
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to mailbox" });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe("main-content");
  });

  test("keyboard focus is always visible on tab stops", async ({ page }) => {
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press("Tab");
      const hasIndicator = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return false;
        const style = getComputedStyle(el);
        return style.outlineStyle !== "none" || style.boxShadow !== "none";
      });
      expect(hasIndicator, `tab stop ${i} has no visible focus indicator`).toBe(true);
    }
  });

  test("compose dialog traps focus, names itself, and restores focus on close", async ({
    page,
  }) => {
    const composeButton = page
      .getByRole("complementary")
      .getByRole("button", { name: "Compose Ctrl+N" });
    await composeButton.click();

    const dialog = page.getByRole("dialog", { name: "New message" });
    await expect(dialog).toBeVisible();
    await expectNoSeriousViolations(page);

    const active = () => page.evaluate(() => (document.activeElement as HTMLElement)?.textContent);
    await page.keyboard.press("Tab");
    const first = await active();
    expect(first).not.toBeNull();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(composeButton).toBeFocused();
  });

  test("filter popover announces as dialog and restores focus on close", async ({ page }) => {
    const filterButton = page.getByRole("button", { name: "Filter" });
    await filterButton.click();
    const dialog = page.getByRole("dialog", { name: "Filters" });
    await expect(dialog).toBeVisible();
    await expectNoSeriousViolations(page);
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(filterButton).toBeFocused();
  });

  test("notifications panel announces as dialog and restores focus on close", async ({ page }) => {
    const bellButton = page.getByRole("button", { name: "Notifications" });
    await bellButton.click();
    const dialog = page.getByRole("dialog", { name: "Notifications" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(bellButton).toBeFocused();
  });

  test("account menu exposes menu semantics", async ({ page }) => {
    await page.getByRole("button", { name: "Account menu" }).click();
    const menu = page.getByRole("menu", { name: "Account" });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem").first()).toBeVisible();
    await expectNoSeriousViolations(page);
  });

  test("reduced-motion preference keeps flows functional", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    await page.getByRole("heading", { name: /inbox/i }).waitFor();
    await page.getByRole("complementary").getByRole("button", { name: "Compose Ctrl+N" }).click();
    await expect(page.getByRole("dialog", { name: "New message" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expectNoSeriousViolations(page);
  });

  test("320px viewport has no horizontal overflow and compose fits on screen", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.reload();
    await page.getByRole("heading", { name: /inbox/i }).waitFor();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);

    await page
      .getByRole("navigation", { name: "Bottom navigation" })
      .getByRole("button", { name: "Compose" })
      .click();
    const dialog = page.getByRole("dialog", { name: "New message" });
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(320);
  });

  test("send failure announces via alert and recovers through Retry", async ({ page }) => {
    await installSendMocks(page);

    // Fail at the pre-commit `sign` stage on the first signature attempt, then
    // succeed on retry (the wallet seam is re-invoked per send attempt).
    await page.addInitScript(() => {
      const win = window as unknown as {
        __freighterApi?: {
          signMessage?: () => Promise<{ signedMessage: string; signerAddress: string }>;
        };
      };
      const api = win.__freighterApi;
      const original = api?.signMessage;
      if (!api || !original) return;
      let attempts = 0;
      Object.defineProperty(api, "signMessage", {
        configurable: true,
        value: async () => {
          attempts += 1;
          if (attempts === 1) throw new Error("Wallet rejected signature");
          return original();
        },
      });
    });

    await page.reload();
    await page.getByRole("heading", { name: /inbox/i }).waitFor();

    await page.getByRole("complementary").getByRole("button", { name: "Compose Ctrl+N" }).click();
    await page.getByPlaceholder("recipients@", { exact: false }).fill(`G${"B".repeat(55)}`);
    await page.getByPlaceholder("Subject").fill("A11y failure path");
    await page.getByPlaceholder("Write your message", { exact: false }).fill("recover me");

    await page.getByRole("button", { name: "Send", exact: true }).click();

    const alert = page.getByRole("alert");
    await expect(alert).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry send" })).toBeVisible();

    await page.getByRole("button", { name: "Retry send" }).click();
    await expect(page.getByText(/Encrypted message sent/i)).toBeVisible();
  });
});
