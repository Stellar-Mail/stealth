import { describe, it, expect } from "vitest";
import {
  validateCampaignMetadata,
  hasBlockingCampaignMetadataIssues,
  type CampaignMetadataInput,
} from "./campaignMetadataValidation";

const validInput: CampaignMetadataInput = {
  name: "Welcome Series",
  description: "Onboarding emails for new demo accounts.",
  status: "draft",
  channel: "email",
  owner: "owner@example.com",
  startDate: "2026-01-01",
  endDate: "2026-01-31",
  tags: ["onboarding", "welcome"],
};

describe("validateCampaignMetadata", () => {
  it("returns no issues for valid metadata", () => {
    const issues = validateCampaignMetadata(validInput);
    expect(issues).toEqual([]);
    expect(hasBlockingCampaignMetadataIssues(issues)).toBe(false);
  });

  it("flags a missing name", () => {
    const issues = validateCampaignMetadata({ ...validInput, name: "  " });
    expect(issues.some((issue) => issue.id === "campaign-name-empty")).toBe(true);
    expect(hasBlockingCampaignMetadataIssues(issues)).toBe(true);
  });

  it("flags an unrecognized status", () => {
    const issues = validateCampaignMetadata({ ...validInput, status: "archived" });
    expect(issues.some((issue) => issue.id === "campaign-status-invalid")).toBe(true);
  });

  it("flags an unrecognized channel", () => {
    const issues = validateCampaignMetadata({ ...validInput, channel: "carrier-pigeon" });
    expect(issues.some((issue) => issue.id === "campaign-channel-invalid")).toBe(true);
  });

  it("requires an owner and warns on unsafe domains", () => {
    const missing = validateCampaignMetadata({ ...validInput, owner: "" });
    expect(missing.some((issue) => issue.id === "campaign-owner-empty")).toBe(true);

    const unsafe = validateCampaignMetadata({ ...validInput, owner: "owner@gmail.com" });
    expect(unsafe.some((issue) => issue.id === "campaign-owner-unsafe-domain")).toBe(true);
  });

  it("rejects an end date that is not after the start date", () => {
    const issues = validateCampaignMetadata({
      ...validInput,
      startDate: "2026-02-01",
      endDate: "2026-01-01",
    });
    expect(issues.some((issue) => issue.id === "campaign-end-before-start")).toBe(true);
  });

  it("flags empty and duplicate tags", () => {
    const issues = validateCampaignMetadata({
      ...validInput,
      tags: ["welcome", "welcome", "  "],
    });
    expect(issues.some((issue) => issue.id === "campaign-tag-2-empty")).toBe(true);
    expect(issues.some((issue) => issue.id === "campaign-tag-1-duplicate")).toBe(true);
  });
});
