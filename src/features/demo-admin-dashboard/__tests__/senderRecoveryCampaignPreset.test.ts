import { describe, expect, it } from "vitest";
import {
  getSenderRecoveryOutcomeSummary,
  senderRecoveryCampaignPreset,
  senderRecoveryRequestStates,
  validateSenderRecoveryCampaignPreset,
} from "../fixtures/senderRecoveryCampaignPreset";

describe("senderRecoveryCampaignPreset", () => {
  it("covers unknown, paid, approved, blocked, and refund education states", () => {
    expect(senderRecoveryRequestStates.map((state) => state.status)).toEqual([
      "unknown",
      "paid-request",
      "approved",
      "blocked",
      "refund-queued",
    ]);
  });

  it("builds one safe fake campaign draft per request state", () => {
    expect(senderRecoveryCampaignPreset.drafts).toHaveLength(senderRecoveryRequestStates.length);
    expect(senderRecoveryCampaignPreset.tags).toContain("sender-recovery");

    for (const draft of senderRecoveryCampaignPreset.drafts) {
      expect(draft.recipients).toHaveLength(1);
      expect(draft.recipients[0]).toMatch(/@stealth\.demo$/);
      expect(draft.body).toContain("fake demo data");
    }
  });

  it("summarizes fake outcomes for reviewers", () => {
    expect(getSenderRecoveryOutcomeSummary()).toBe(
      "5 recovery states: 1 approved, 1 blocked, 1 refund education.",
    );
  });

  it("validates the preset shape and safety constraints", () => {
    expect(validateSenderRecoveryCampaignPreset()).toEqual([]);
    expect(
      validateSenderRecoveryCampaignPreset(senderRecoveryCampaignPreset, [
        {
          ...senderRecoveryRequestStates[0],
          senderAddress: "person@example.com",
        },
      ]),
    ).toContain("Unsafe sender address for sender-recovery-unknown.");
  });
});
