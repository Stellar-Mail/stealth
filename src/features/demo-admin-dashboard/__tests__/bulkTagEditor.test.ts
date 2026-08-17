import { describe, expect, it } from "vitest";
import type { CampaignSnapshot } from "../types/campaignSnapshot";
import {
  applyBulkTagEdit,
  normalizeTag,
  normalizeTags,
  parseTagInput,
  summarizeBulkTagEdit,
} from "../bulkTagEditor";

function makeCampaign(id: string, name: string, tags: string[]): CampaignSnapshot {
  return {
    id,
    name,
    description: `${name} description`,
    targetAudience: "Test Audience",
    tags,
    timestamp: "2026-06-16T12:00:00Z",
    status: "draft",
    drafts: [],
  };
}

function byId(campaigns: CampaignSnapshot[], id: string): CampaignSnapshot {
  const found = campaigns.find((campaign) => campaign.id === id);
  if (!found) {
    throw new Error(`Campaign ${id} not found`);
  }
  return found;
}

function sample(): CampaignSnapshot[] {
  return [
    makeCampaign("c1", "Welcome Series", ["onboarding", "welcome"]),
    makeCampaign("c2", "Security Notice", ["security", "alert"]),
    makeCampaign("c3", "Monthly News", ["newsletter"]),
  ];
}

describe("tag normalization", () => {
  it("lower-cases and trims a single tag", () => {
    expect(normalizeTag("  Onboarding  ")).toBe("onboarding");
  });

  it("normalizes, drops blanks, and de-duplicates a list", () => {
    expect(normalizeTags(["Welcome", "welcome", "  ", "Stellar"])).toEqual(["welcome", "stellar"]);
  });

  it("parses comma or whitespace separated input", () => {
    expect(parseTagInput("VIP, vip  promo")).toEqual(["vip", "promo"]);
  });
});

describe("applyBulkTagEdit - add", () => {
  it("adds new tags to selected campaigns without mutating input", () => {
    const campaigns = sample();
    const result = applyBulkTagEdit(campaigns, ["c1", "c3"], ["promo"], "add");

    expect(campaigns[0].tags).toEqual(["onboarding", "welcome"]);
    expect(byId(result.campaigns, "c1").tags).toEqual(["onboarding", "welcome", "promo"]);
    expect(byId(result.campaigns, "c3").tags).toEqual(["newsletter", "promo"]);
    expect(byId(result.campaigns, "c2").tags).toEqual(["security", "alert"]);
  });

  it("prevents duplicate tags", () => {
    const result = applyBulkTagEdit(sample(), ["c1"], ["welcome", "promo"], "add");

    expect(byId(result.campaigns, "c1").tags).toEqual(["onboarding", "welcome", "promo"]);
    expect(result.changes[0].applied).toEqual(["promo"]);
    expect(result.changes[0].skipped).toEqual(["welcome"]);
    expect(result.summary.totalApplied).toBe(1);
    expect(result.summary.totalSkipped).toBe(1);
  });
});

describe("applyBulkTagEdit - remove", () => {
  it("removes existing tags and skips ones not present", () => {
    const result = applyBulkTagEdit(sample(), ["c1", "c2"], ["alert", "missing"], "remove");

    expect(byId(result.campaigns, "c1").tags).toEqual(["onboarding", "welcome"]);
    expect(byId(result.campaigns, "c2").tags).toEqual(["security"]);
    expect(result.summary.totalApplied).toBe(1);
    expect(result.summary.affectedCount).toBe(1);
  });
});

describe("summarizeBulkTagEdit", () => {
  it("summarizes an add across multiple campaigns", () => {
    const result = applyBulkTagEdit(sample(), ["c1", "c2"], ["promo"], "add");
    expect(summarizeBulkTagEdit(result)).toBe("Added 2 tags across 2 campaigns.");
  });

  it("reports when nothing changed", () => {
    const result = applyBulkTagEdit(sample(), ["c1"], ["welcome"], "add");
    expect(summarizeBulkTagEdit(result)).toBe("No changes - all were duplicates (1 skipped).");
  });
});
