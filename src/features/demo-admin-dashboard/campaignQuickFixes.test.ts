import { describe, it, expect } from "vitest";
import { applyQuickFixes } from "./campaignQuickFixes";
import type { CampaignRecord } from "./campaignQuickFixes";

describe("Campaign Quick Fixes", () => {
  it('should fix missing tags by applying an "untagged" label', () => {
    const input: CampaignRecord[] = [{ id: "1", name: "Campaign A", tags: [] }];
    const results = applyQuickFixes(input);

    expect(results[0].fixed.tags).toEqual(["untagged"]);
    expect(results[0].appliedFixes).toContain("fixMissingTags");
  });

  it("should fix duplicate names by appending a counter", () => {
    const input: CampaignRecord[] = [
      { id: "1", name: "Promo Campaign" },
      { id: "2", name: "Promo Campaign" },
      { id: "3", name: "Promo Campaign" },
    ];
    const results = applyQuickFixes(input);

    expect(results[0].fixed.name).toBe("Promo Campaign");
    expect(results[1].fixed.name).toBe("Promo Campaign (1)");
    expect(results[2].fixed.name).toBe("Promo Campaign (2)");
    expect(results[1].appliedFixes).toContain("fixDuplicateNames");
    expect(results[2].appliedFixes).toContain("fixDuplicateNames");
  });

  it("should fix invalid dates and logical date ranges", () => {
    const input: CampaignRecord[] = [
      { id: "1", name: "Bad Dates", startDate: "not-a-date", endDate: "invalid" },
      {
        id: "2",
        name: "Reversed Dates",
        startDate: "2023-12-01T00:00:00.000Z",
        endDate: "2023-11-01T00:00:00.000Z",
      },
    ];
    const results = applyQuickFixes(input);

    expect(results[0].fixed.startDate).toBe("2023-01-01T00:00:00.000Z");
    expect(results[0].fixed.endDate).toBe("2023-12-31T23:59:59.999Z");
    expect(results[0].appliedFixes).toContain("fixInvalidDates");

    // End date should be clamped to start date if reversed
    expect(results[1].fixed.endDate).toBe("2023-12-01T00:00:00.000Z");
    expect(results[1].appliedFixes).toContain("fixInvalidDates");
  });

  it("should return empty appliedFixes when no fixes are needed", () => {
    const input: CampaignRecord[] = [
      { id: "1", name: "Perfect Campaign", tags: ["vip"], startDate: "2023-01-01T00:00:00.000Z" },
    ];
    const results = applyQuickFixes(input);

    expect(results[0].fixed).toEqual(input[0]); // Reference should be exactly the same
    expect(results[0].appliedFixes).toHaveLength(0);
  });
});
