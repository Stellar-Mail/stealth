import { describe, expect, it } from "vitest";
import {
  campaignSeedExamples,
  getCampaignSeedExamplesByCategory,
  getCampaignSeedExamplesByTag,
} from "../seed-data/campaignSeedExamples";
import {
  isSafeDemoRecipient,
  toCampaignSeedSlug,
  validateCampaignSeedScenario,
} from "../seed-helpers/campaignSeed";

describe("campaign seed helpers", () => {
  it("slugifies scenario names using the contributor convention", () => {
    expect(toCampaignSeedSlug("Welcome Series")).toBe("welcome-series");
    expect(toCampaignSeedSlug("Security Alert Review")).toBe("security-alert-review");
  });

  it("accepts valid demo scenarios and rejects unsafe recipients", () => {
    const validScenario = campaignSeedExamples[0];
    expect(validateCampaignSeedScenario(validScenario)).toEqual([]);

    expect(isSafeDemoRecipient("reviewer@company.com")).toBe(false);
    expect(isSafeDemoRecipient("ops*stealth.demo")).toBe(true);
    expect(isSafeDemoRecipient("support@example.org")).toBe(true);
  });

  it("returns deterministic grouped examples by category or tag", () => {
    expect(getCampaignSeedExamplesByTag(campaignSeedExamples, "campaign")).toHaveLength(
      campaignSeedExamples.length,
    );
    expect(getCampaignSeedExamplesByCategory(campaignSeedExamples, "newsletter")).toHaveLength(1);
  });
});
