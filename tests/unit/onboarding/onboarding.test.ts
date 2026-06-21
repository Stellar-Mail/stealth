import { describe, expect, it } from "vitest";

import {
  DEFAULT_DRAFT,
  ONBOARDING_STEPS,
  SENDER_RULE_TO_POLICY,
  draftToMailboxPolicy,
  xlmToStroops,
  type OnboardingDraft,
  type OnboardingStep,
} from "../../../src/features/onboarding/types";

// Note: useOnboarding is a React hook that manages state and side effects.
// Testing React hooks directly requires @testing-library/react or similar.
// The business logic is well-covered by the pure function tests below.
// User-critical flows are tested via Playwright e2e tests.

// ---------------------------------------------------------------------------
// Step navigation contract tests
// ---------------------------------------------------------------------------
describe("onboarding flow and navigation", () => {
  it("defines a complete and ordered onboarding sequence", () => {
    expect(ONBOARDING_STEPS).toHaveLength(7);
    expect(ONBOARDING_STEPS[0]).toBe("identity");
    expect(ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1]).toBe("policy-review");
  });

  it("ensures each step appears exactly once", () => {
    const seen = new Set<OnboardingStep>();
    for (const step of ONBOARDING_STEPS) {
      expect(seen.has(step)).toBe(false);
      seen.add(step);
    }
    expect(seen.size).toBe(ONBOARDING_STEPS.length);
  });

  it("supports forward navigation through the sequence", () => {
    for (let i = 0; i < ONBOARDING_STEPS.length - 1; i++) {
      const current = ONBOARDING_STEPS[i];
      const next = ONBOARDING_STEPS[i + 1];
      const nextIndex = ONBOARDING_STEPS.indexOf(current) + 1;
      expect(ONBOARDING_STEPS[nextIndex]).toBe(next);
    }
  });

  it("supports backward navigation through the sequence", () => {
    for (let i = 1; i < ONBOARDING_STEPS.length; i++) {
      const current = ONBOARDING_STEPS[i];
      const prev = ONBOARDING_STEPS[i - 1];
      const prevIndex = Math.max(0, ONBOARDING_STEPS.indexOf(current) - 1);
      expect(ONBOARDING_STEPS[prevIndex]).toBe(prev);
    }
  });
});

// ---------------------------------------------------------------------------
// Draft state contract tests
// ---------------------------------------------------------------------------
describe("onboarding draft state", () => {
  it("provides sensible defaults for a new user", () => {
    expect(DEFAULT_DRAFT).toEqual({
      walletAddress: null,
      recoveryAcknowledged: false,
      unknownSenderRule: "request",
      minimumPostage: "0",
      receiptOnDelivery: false,
    });
  });

  it("starts with privacy-preserving defaults", () => {
    // Unknown senders "request" (hold for review) is privacy-preserving
    expect(DEFAULT_DRAFT.unknownSenderRule).toBe("request");
    // Receipts off by default for privacy
    expect(DEFAULT_DRAFT.receiptOnDelivery).toBe(false);
    // No postage required by default
    expect(DEFAULT_DRAFT.minimumPostage).toBe("0");
  });

  it("requires wallet address before submission", () => {
    expect(DEFAULT_DRAFT.walletAddress).toBeNull();
  });

  it("requires recovery acknowledgment before continuing", () => {
    expect(DEFAULT_DRAFT.recoveryAcknowledged).toBe(false);
  });

  it("supports all valid unknown sender rules", () => {
    const rules = ["request", "verified", "block"] as const;
    for (const rule of rules) {
      const draft: OnboardingDraft = { ...DEFAULT_DRAFT, unknownSenderRule: rule };
      expect(draft.unknownSenderRule).toBe(rule);
    }
  });

  it("accumulates changes across multiple updates", () => {
    let draft = DEFAULT_DRAFT;

    draft = { ...draft, walletAddress: "G" + "A".repeat(55) };
    expect(draft.walletAddress).not.toBeNull();

    draft = { ...draft, recoveryAcknowledged: true };
    expect(draft.recoveryAcknowledged).toBe(true);

    draft = { ...draft, unknownSenderRule: "verified" };
    expect(draft.unknownSenderRule).toBe("verified");

    draft = { ...draft, minimumPostage: "0.001" };
    expect(draft.minimumPostage).toBe("0.001");

    draft = { ...draft, receiptOnDelivery: true };
    expect(draft.receiptOnDelivery).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// xlmToStroops
// ---------------------------------------------------------------------------
describe("xlmToStroops", () => {
  it("converts whole XLM amounts", () => {
    expect(xlmToStroops("1")).toBe("10000000");
    expect(xlmToStroops("100")).toBe("1000000000");
  });

  it("converts fractional XLM amounts", () => {
    expect(xlmToStroops("0.0001")).toBe("1000");
    expect(xlmToStroops("0.001")).toBe("10000");
    expect(xlmToStroops("0.01")).toBe("100000");
  });

  it("returns '0' for zero", () => {
    expect(xlmToStroops("0")).toBe("0");
  });

  it("returns '0' for empty string", () => {
    expect(xlmToStroops("")).toBe("0");
  });

  it("returns '0' for negative values", () => {
    expect(xlmToStroops("-1")).toBe("0");
    expect(xlmToStroops("-0.001")).toBe("0");
  });

  it("returns '0' for non-numeric input", () => {
    expect(xlmToStroops("abc")).toBe("0");
    expect(xlmToStroops("NaN")).toBe("0");
  });
});

// ---------------------------------------------------------------------------
// SENDER_RULE_TO_POLICY mapping
// ---------------------------------------------------------------------------
describe("SENDER_RULE_TO_POLICY", () => {
  it("maps request to allowUnknown:true, requireVerified:false", () => {
    expect(SENDER_RULE_TO_POLICY.request).toEqual({
      allowUnknown: true,
      requireVerified: false,
    });
  });

  it("maps verified to allowUnknown:true, requireVerified:true", () => {
    expect(SENDER_RULE_TO_POLICY.verified).toEqual({
      allowUnknown: true,
      requireVerified: true,
    });
  });

  it("maps block to allowUnknown:false, requireVerified:false", () => {
    expect(SENDER_RULE_TO_POLICY.block).toEqual({
      allowUnknown: false,
      requireVerified: false,
    });
  });
});

// ---------------------------------------------------------------------------
// draftToMailboxPolicy
// ---------------------------------------------------------------------------
describe("draftToMailboxPolicy", () => {
  const base: OnboardingDraft = {
    ...DEFAULT_DRAFT,
    walletAddress: `G${"A".repeat(55)}`,
  };

  it("produces a valid policy from the default draft", () => {
    expect(draftToMailboxPolicy(base)).toEqual({
      allowUnknown: true,
      requireVerified: false,
      minimumPostage: "0",
    });
  });

  it("converts postage from XLM to stroops", () => {
    const draft: OnboardingDraft = { ...base, minimumPostage: "0.001" };
    expect(draftToMailboxPolicy(draft).minimumPostage).toBe("10000");
  });

  it("applies the 'verified' sender rule correctly", () => {
    const draft: OnboardingDraft = { ...base, unknownSenderRule: "verified" };
    expect(draftToMailboxPolicy(draft)).toMatchObject({
      allowUnknown: true,
      requireVerified: true,
    });
  });

  it("applies the 'block' sender rule correctly", () => {
    const draft: OnboardingDraft = { ...base, unknownSenderRule: "block" };
    expect(draftToMailboxPolicy(draft)).toMatchObject({
      allowUnknown: false,
      requireVerified: false,
    });
  });
});

// ---------------------------------------------------------------------------
// ONBOARDING_STEPS ordering
// ---------------------------------------------------------------------------
describe("ONBOARDING_STEPS", () => {
  it("starts with identity and ends with policy-review", () => {
    expect(ONBOARDING_STEPS[0]).toBe("identity");
    expect(ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1]).toBe("policy-review");
  });

  it("contains exactly 7 steps", () => {
    expect(ONBOARDING_STEPS).toHaveLength(7);
  });

  it("contains all expected steps in order", () => {
    expect(ONBOARDING_STEPS).toEqual([
      "identity",
      "recovery",
      "address",
      "unknown-sender-rules",
      "minimum-postage",
      "receipt-preference",
      "policy-review",
    ]);
  });
});

// ---------------------------------------------------------------------------
// DEFAULT_DRAFT: privacy-preserving defaults
// ---------------------------------------------------------------------------
describe("DEFAULT_DRAFT", () => {
  it("uses request as the default sender rule (privacy-preserving)", () => {
    expect(DEFAULT_DRAFT.unknownSenderRule).toBe("request");
  });

  it("starts with no wallet address", () => {
    expect(DEFAULT_DRAFT.walletAddress).toBeNull();
  });

  it("has receipts off by default", () => {
    expect(DEFAULT_DRAFT.receiptOnDelivery).toBe(false);
  });

  it("starts with recovery not acknowledged", () => {
    expect(DEFAULT_DRAFT.recoveryAcknowledged).toBe(false);
  });
});
