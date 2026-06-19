/**
 * Unit tests for usePostageQuote logic.
 *
 * Because @testing-library/react is not installed in this project, we test
 * the hook's constituent logic units directly:
 *  - xlmFromStroops conversion (from RecipientPolicyBanner)
 *  - isPolicyBlocking / isTrustedSender / getMinimumPostage helpers
 *  - composeValidation integration with PostageQuote
 *
 * Integration tests that actually render the hook are candidates for a future
 * e2e or Playwright suite once the full test environment is expanded.
 */
import { describe, it, expect } from "vitest";
import type { PostageQuote } from "@/features/compose/usePostageQuote";
import {
  isPolicyBlocking,
  isTrustedSender,
  getMinimumPostage,
  xlmFromStroops,
} from "@/features/compose/RecipientPolicyBanner";
import { validateComposeDraft } from "@/components/mail/composeValidation";

// ---------------------------------------------------------------------------
// xlmFromStroops
// ---------------------------------------------------------------------------

describe("xlmFromStroops", () => {
  it("converts 0 stroops to '0'", () => {
    expect(xlmFromStroops("0")).toBe("0");
  });

  it("converts 10_000_000 stroops to '1'", () => {
    expect(xlmFromStroops("10000000")).toBe("1");
  });

  it("converts 1_000_000 stroops to '0.1'", () => {
    expect(xlmFromStroops("1000000")).toBe("0.1");
  });

  it("converts 100 stroops to '0.00001'", () => {
    expect(xlmFromStroops("100")).toBe("0.00001");
  });

  it("trims trailing zeros from fractional part", () => {
    // 5_000_000 stroops = 0.5 XLM (not 0.5000000)
    expect(xlmFromStroops("5000000")).toBe("0.5");
  });

  it("returns input unchanged for invalid bigint strings", () => {
    expect(xlmFromStroops("not-a-number")).toBe("not-a-number");
  });
});

// ---------------------------------------------------------------------------
// isPolicyBlocking
// ---------------------------------------------------------------------------

describe("isPolicyBlocking", () => {
  it("returns false when status is idle", () => {
    expect(isPolicyBlocking({ status: "idle" })).toBe(false);
  });

  it("returns false when status is loading", () => {
    expect(isPolicyBlocking({ status: "loading" })).toBe(false);
  });

  it("returns false when status is error", () => {
    expect(isPolicyBlocking({ status: "error", message: "network error" })).toBe(false);
  });

  it("returns true when quote.eligible is false (sender_blocked)", () => {
    const quote: PostageQuote = {
      amount: "100",
      eligible: false,
      reason: "sender_blocked",
      trusted: false,
    };
    expect(isPolicyBlocking({ status: "quoted", quote })).toBe(true);
  });

  it("returns false when sender is trusted (eligible: true)", () => {
    const quote: PostageQuote = {
      amount: "0",
      eligible: true,
      reason: "trusted_sender",
      trusted: true,
    };
    expect(isPolicyBlocking({ status: "quoted", quote })).toBe(false);
  });

  it("returns false for mailbox_minimum (eligible: true)", () => {
    const quote: PostageQuote = {
      amount: "1000000",
      eligible: true,
      reason: "mailbox_minimum",
      trusted: false,
    };
    expect(isPolicyBlocking({ status: "quoted", quote })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isTrustedSender
// ---------------------------------------------------------------------------

describe("isTrustedSender", () => {
  it("returns false for non-quoted states", () => {
    expect(isTrustedSender({ status: "idle" })).toBe(false);
    expect(isTrustedSender({ status: "loading" })).toBe(false);
    expect(isTrustedSender({ status: "error", message: "x" })).toBe(false);
  });

  it("returns true when quote.trusted is true", () => {
    const quote: PostageQuote = {
      amount: "0",
      eligible: true,
      reason: "trusted_sender",
      trusted: true,
    };
    expect(isTrustedSender({ status: "quoted", quote })).toBe(true);
  });

  it("returns false when quote.trusted is false", () => {
    const quote: PostageQuote = {
      amount: "1000000",
      eligible: true,
      reason: "mailbox_minimum",
      trusted: false,
    };
    expect(isTrustedSender({ status: "quoted", quote })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getMinimumPostage
// ---------------------------------------------------------------------------

describe("getMinimumPostage", () => {
  it("returns null for non-quoted states", () => {
    expect(getMinimumPostage({ status: "idle" })).toBe(null);
    expect(getMinimumPostage({ status: "loading" })).toBe(null);
    expect(getMinimumPostage({ status: "error", message: "x" })).toBe(null);
  });

  it("returns '0' for trusted sender", () => {
    const quote: PostageQuote = {
      amount: "0",
      eligible: true,
      reason: "trusted_sender",
      trusted: true,
    };
    expect(getMinimumPostage({ status: "quoted", quote })).toBe("0");
  });

  it("returns null when sender is blocked (ineligible)", () => {
    const quote: PostageQuote = {
      amount: "100",
      eligible: false,
      reason: "sender_blocked",
      trusted: false,
    };
    expect(getMinimumPostage({ status: "quoted", quote })).toBe(null);
  });

  it("returns the amount string for mailbox_minimum", () => {
    const quote: PostageQuote = {
      amount: "5000000",
      eligible: true,
      reason: "mailbox_minimum",
      trusted: false,
    };
    expect(getMinimumPostage({ status: "quoted", quote })).toBe("5000000");
  });
});

// ---------------------------------------------------------------------------
// validateComposeDraft — policy quote integration
// ---------------------------------------------------------------------------

describe("validateComposeDraft with policyQuote", () => {
  const validTo = "alice*stellar.org";
  const validBody = "Hello world";
  const validPostage = "0.5";

  it("blocks send when policyQuote.eligible is false", () => {
    const policyQuote: PostageQuote = {
      amount: "100",
      eligible: false,
      reason: "sender_blocked",
      trusted: false,
    };

    const result = validateComposeDraft({
      to: validTo,
      body: validBody,
      postage: validPostage,
      policyQuote,
    });

    expect(result).toBe("Recipient has blocked this sender");
  });

  it("allows send without postage when policyQuote.trusted is true", () => {
    const policyQuote: PostageQuote = {
      amount: "0",
      eligible: true,
      reason: "trusted_sender",
      trusted: true,
    };

    const result = validateComposeDraft({
      to: validTo,
      body: validBody,
      postage: "0", // No postage required for trusted sender
      policyQuote,
    });

    // Should be null (valid) since trusted senders skip postage check
    expect(result).toBeNull();
  });

  it("blocks send when postage is below quoted minimum", () => {
    const policyQuote: PostageQuote = {
      amount: "10000000", // 1 XLM minimum
      eligible: true,
      reason: "mailbox_minimum",
      trusted: false,
    };

    const result = validateComposeDraft({
      to: validTo,
      body: validBody,
      postage: "0.0001", // 1000 stroops — below 10,000,000 minimum
      policyQuote,
    });

    expect(result).toContain("Postage below recipient's minimum");
  });

  it("allows send when postage meets the quoted minimum", () => {
    const policyQuote: PostageQuote = {
      amount: "1000000", // 0.1 XLM minimum
      eligible: true,
      reason: "mailbox_minimum",
      trusted: false,
    };

    const result = validateComposeDraft({
      to: validTo,
      body: validBody,
      postage: "0.1", // Exactly 1,000,000 stroops
      policyQuote,
    });

    expect(result).toBeNull();
  });

  it("falls back to basic postage check when policyQuote is null", () => {
    const result = validateComposeDraft({
      to: validTo,
      body: validBody,
      postage: "0", // Zero postage, no policy quote
      policyQuote: null,
    });

    // Basic postage check: postage === 0, so postage === "required" on recipients
    // The recipient is in "resolving" state during initial sync check, so it
    // returns "All recipients must be verified" first
    expect(result).not.toBeNull();
  });

  it("returns body error before policy check", () => {
    const policyQuote: PostageQuote = {
      amount: "100",
      eligible: false,
      reason: "sender_blocked",
      trusted: false,
    };

    const result = validateComposeDraft({
      to: validTo,
      body: "", // Empty body
      postage: validPostage,
      policyQuote,
    });

    expect(result).toBe("Please enter a message");
  });
});
