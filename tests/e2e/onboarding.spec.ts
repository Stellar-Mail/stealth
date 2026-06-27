import { test, expect } from "@playwright/test";

// Deterministic Stellar addresses for testing
const DEMO_WALLET = `G${"D".repeat(55)}`;

test.describe("Onboarding flow", () => {
  test.beforeEach(async ({ page }) => {
    // Install a deterministic wallet stub so Freighter calls succeed
    // Also clear localStorage to ensure fresh onboarding state
    await page.addInitScript((walletAddress) => {
      // Clear onboarding state from localStorage
      try {
        localStorage.removeItem("stealth-onboarding-v1");
      } catch {
        // localStorage may not be available in some contexts
      }

      Object.defineProperty(window, "__freighterApi", {
        configurable: true,
        value: {
          isConnected: () => Promise.resolve({ isConnected: true }),
          requestAccess: () => Promise.resolve({ address: walletAddress }),
        },
      });
    }, DEMO_WALLET);

    // Clear cookies to ensure fresh state
    await page.context().clearCookies();

    // Navigate to the app home
    await page.goto("/");
  });

  test("completes full onboarding with default settings (successful path)", async ({ page }) => {
    // Step 1: Identity - Connect wallet
    await expect(page.getByRole("heading", { name: "Connect your wallet" })).toBeVisible();
    const connectButton = page.getByRole("button", {
      name: /Connect wallet|Waiting for Freighter/,
    });
    await connectButton.click();

    // Wait for wallet connection to succeed and auto-advance
    await expect(page.getByRole("heading", { name: "Secure your recovery" })).toBeVisible({
      timeout: 5000,
    });

    // Step 2: Recovery - Acknowledge backups
    await expect(page.getByText(/backed up my wallet seed phrase/i)).toBeVisible();
    const checkboxes = await page.locator('button:has(input[type="checkbox"])').count();
    expect(checkboxes).toBe(2);

    // Both checkboxes must be checked to enable "Continue"
    for (let i = 0; i < 2; i++) {
      await page.locator('button:has(input[type="checkbox"])').nth(i).click();
    }

    const continueButton = page.getByRole("button", { name: "Continue" });
    await expect(continueButton).not.toBeDisabled();
    await continueButton.click();

    // Step 3: Address - Display mailbox address
    await expect(page.getByRole("heading", { name: "Your mailbox address" })).toBeVisible();
    await expect(page.getByText(DEMO_WALLET)).toBeVisible();

    const nextButton = page.getByRole("button", { name: "Continue" });
    await nextButton.click();

    // Step 4: Unknown sender rules - Default to "request" (Recommended)
    await expect(page.getByRole("heading", { name: "Who can mail you" })).toBeVisible();
    const recommendedBadge = page.getByText("Recommended");
    await expect(recommendedBadge).toBeVisible();

    // Default "request" should be visually selected
    const requestOption = page
      .getByRole("button")
      .filter({ has: page.getByText("Request approval") });
    await expect(requestOption).toHaveClass(/border-emerald-400|bg-emerald-400/);

    await page.getByRole("button", { name: "Next" }).click();

    // Step 5: Minimum postage - Default to "Free"
    await expect(page.getByRole("heading", { name: "Minimum postage" })).toBeVisible();
    const freeButton = page.getByRole("button", { name: "Free" });
    await expect(freeButton).toBeVisible();

    // Free should be selected by default or we click it
    await freeButton.click();

    await page.getByRole("button", { name: "Next" }).click();

    // Step 6: Receipt preference - Disabled by default
    await expect(page.getByRole("heading", { name: "Delivery receipts" })).toBeVisible();
    const noReceiptsOption = page
      .getByRole("button")
      .filter({ has: page.getByText("No receipts") });
    await expect(noReceiptsOption).toBeVisible();

    await page.getByRole("button", { name: "Next" }).click();

    // Step 7: Policy review and activation
    await expect(page.getByRole("heading", { name: "Review your mailbox policy" })).toBeVisible();

    // Verify summary shows correct settings
    await expect(page.getByText(/Hold for review/)).toBeVisible(); // request rule
    await expect(page.getByText(/None/)).toBeVisible(); // no minimum postage
    await expect(page.getByText(/Disabled/)).toBeVisible(); // no receipts

    // Submit should succeed
    const submitButton = page.getByRole("button", { name: "Activate" });
    await expect(submitButton).not.toBeDisabled();
    await submitButton.click();

    // After submission, we expect the app to clear the onboarding state
    // and potentially redirect to the main app
    await expect(page.getByRole("heading", { name: "Connect your wallet" })).not.toBeVisible({
      timeout: 5000,
    });
  });

  test("handles block rule selection correctly", async ({ page }) => {
    // Connect wallet
    await page.getByRole("button", { name: /Connect wallet|Waiting for Freighter/ }).click();
    await expect(page.getByRole("heading", { name: "Secure your recovery" })).toBeVisible({
      timeout: 5000,
    });

    // Acknowledge recovery
    for (let i = 0; i < 2; i++) {
      await page.locator('button:has(input[type="checkbox"])').nth(i).click();
    }
    await page.getByRole("button", { name: "Continue" }).click();

    // Skip to address, then unknown sender rules
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Who can mail you" })).toBeVisible();

    // Select "block" rule (Maximum)
    const blockOption = page
      .getByRole("button")
      .filter({ has: page.getByText("Trusted contacts only") });
    await blockOption.click();

    // Verify badge updates
    await expect(page.getByText("Maximum")).toBeVisible();

    // Advance to policy review
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();

    // Verify policy review shows the selected rule
    await expect(page.getByRole("heading", { name: "Review your mailbox policy" })).toBeVisible();
    await expect(page.getByText(/Trusted contacts only/)).toBeVisible();
  });

  test("handles postage input and validation", async ({ page }) => {
    // Connect wallet
    await page.getByRole("button", { name: /Connect wallet|Waiting for Freighter/ }).click();
    await expect(page.getByRole("heading", { name: "Secure your recovery" })).toBeVisible({
      timeout: 5000,
    });

    // Acknowledge recovery
    for (let i = 0; i < 2; i++) {
      await page.locator('button:has(input[type="checkbox"])').nth(i).click();
    }
    await page.getByRole("button", { name: "Continue" }).click();

    // Skip to postage step
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();

    // Postage step
    await expect(page.getByRole("heading", { name: "Minimum postage" })).toBeVisible();

    // Try entering custom value
    const customInput = page.locator('input[placeholder*="XLM"]');
    await customInput.fill("0.01");

    // Should allow advancing with valid input
    const nextButton = page.getByRole("button", { name: "Next" });
    await expect(nextButton).not.toBeDisabled();
    await nextButton.click();

    // Verify in policy review
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("heading", { name: "Review your mailbox policy" })).toBeVisible();
    await expect(page.getByText(/0.01 XLM/)).toBeVisible();
  });

  test("enables navigation between steps", async ({ page }) => {
    // Connect wallet
    await page.getByRole("button", { name: /Connect wallet|Waiting for Freighter/ }).click();
    await expect(page.getByRole("heading", { name: "Secure your recovery" })).toBeVisible({
      timeout: 5000,
    });

    // Should show "Back" button
    const backButton = page.getByRole("button", { name: "Back" });
    await expect(backButton).toBeVisible();

    // Click back
    await backButton.click();

    // Should return to connect wallet step
    await expect(page.getByRole("heading", { name: "Connect your wallet" })).toBeVisible();

    // Forward again
    await page.getByRole("button", { name: /Connect wallet|Waiting for Freighter/ }).click();
    await expect(page.getByRole("heading", { name: "Secure your recovery" })).toBeVisible({
      timeout: 5000,
    });
  });

  test("shows progress indicator for current step", async ({ page }) => {
    // Connect wallet
    await page.getByRole("button", { name: /Connect wallet|Waiting for Freighter/ }).click();
    await expect(page.getByRole("heading", { name: "Secure your recovery" })).toBeVisible({
      timeout: 5000,
    });

    // Progress indicator should show "2 / 7" (recovery is step 2)
    await expect(page.getByText(/2\s*\/\s*7/)).toBeVisible();

    // Acknowledge and advance
    for (let i = 0; i < 2; i++) {
      await page.locator('button:has(input[type="checkbox"])').nth(i).click();
    }
    await page.getByRole("button", { name: "Continue" }).click();

    // Now should show "3 / 7" (address step)
    await expect(page.getByText(/3\s*\/\s*7/)).toBeVisible();
  });

  test("persists draft state across page refresh (resumability)", async ({ page }) => {
    // Start onboarding
    await page.getByRole("button", { name: /Connect wallet|Waiting for Freighter/ }).click();
    await expect(page.getByRole("heading", { name: "Secure your recovery" })).toBeVisible({
      timeout: 5000,
    });

    // Acknowledge and advance to address step
    for (let i = 0; i < 2; i++) {
      await page.locator('button:has(input[type="checkbox"])').nth(i).click();
    }
    await page.getByRole("button", { name: "Continue" }).click();

    // Now at address step - refresh the page
    await page.reload();

    // Should resume at address step (showing wallet address)
    await expect(page.getByRole("heading", { name: "Your mailbox address" })).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText(DEMO_WALLET)).toBeVisible();

    // Verify we can continue from here
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Who can mail you" })).toBeVisible();
  });
});
