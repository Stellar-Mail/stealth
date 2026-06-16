import { describe, expect, it } from "vitest";

import {
  DEFAULT_DRAFT,
  ONBOARDING_STEPS,
  SENDER_RULE_TO_POLICY,
  draftToMailboxPolicy,
  xlmToStroops,
  type OnboardingDraft,
} from "../../../src/features/onboarding/types";

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
