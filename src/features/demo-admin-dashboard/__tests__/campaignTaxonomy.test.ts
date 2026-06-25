import { describe, expect, it } from "vitest";
import {
  AUDIENCE_SEGMENTS_BY_ID,
} from "../fixtures/audienceSegmentFixtures";
import {
  CAMPAIGN_GROUPS_BY_ID,
  CAMPAIGN_RECORDS_BY_ID,
  campaignGroups,
  campaignMessageLinks,
  campaignRecords,
  campaignRelationshipExamples,
} from "../fixtures/campaignTaxonomyFixtures";

describe("campaignGroups fixture", () => {
  it("has unique IDs", () => {
    const ids = campaignGroups.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every campaignId in a group exists in campaignRecords", () => {
    for (const group of campaignGroups) {
      for (const campaignId of group.campaignIds) {
        expect(CAMPAIGN_RECORDS_BY_ID[campaignId]).toBeDefined();
      }
    }
  });

  it("has a non-empty name and description for each group", () => {
    for (const group of campaignGroups) {
      expect(group.name.trim().length).toBeGreaterThan(0);
      expect(group.description.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("campaignRecords fixture", () => {
  it("has unique IDs", () => {
    const ids = campaignRecords.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every record references a valid groupId", () => {
    for (const record of campaignRecords) {
      expect(CAMPAIGN_GROUPS_BY_ID[record.groupId]).toBeDefined();
    }
  });

  it("every record references a valid audienceId", () => {
    for (const record of campaignRecords) {
      expect(AUDIENCE_SEGMENTS_BY_ID[record.audienceId]).toBeDefined();
    }
  });

  it("every record has at least one messageId", () => {
    for (const record of campaignRecords) {
      expect(record.messageIds.length).toBeGreaterThan(0);
    }
  });

  it("every record has an ISO 8601 createdAt and updatedAt", () => {
    const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
    for (const record of campaignRecords) {
      expect(record.createdAt).toMatch(iso);
      expect(record.updatedAt).toMatch(iso);
    }
  });

  it("every record belongs to a group that lists it", () => {
    for (const record of campaignRecords) {
      const group = CAMPAIGN_GROUPS_BY_ID[record.groupId];
      expect(group.campaignIds).toContain(record.id);
    }
  });
});

describe("campaignMessageLinks fixture", () => {
  it("every link references a valid campaignId", () => {
    for (const link of campaignMessageLinks) {
      expect(CAMPAIGN_RECORDS_BY_ID[link.campaignId]).toBeDefined();
    }
  });

  it("every campaignRecord messageId has a corresponding link", () => {
    for (const record of campaignRecords) {
      for (const messageId of record.messageIds) {
        const link = campaignMessageLinks.find(
          (l) => l.campaignId === record.id && l.messageId === messageId,
        );
        expect(link).toBeDefined();
      }
    }
  });

  it("sequenceIndex values are non-negative integers", () => {
    for (const link of campaignMessageLinks) {
      expect(link.sequenceIndex).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(link.sequenceIndex)).toBe(true);
    }
  });

  it("each campaign's links have unique sequenceIndex values", () => {
    const byCampaign: Record<string, number[]> = {};
    for (const link of campaignMessageLinks) {
      (byCampaign[link.campaignId] ??= []).push(link.sequenceIndex);
    }
    for (const [campaignId, indices] of Object.entries(byCampaign)) {
      expect(new Set(indices).size).toBe(indices.length);
      void campaignId;
    }
  });
});

describe("campaignRelationshipExamples fixture", () => {
  it("every example has a valid campaign, group, and non-empty audienceLabel", () => {
    for (const example of campaignRelationshipExamples) {
      expect(CAMPAIGN_RECORDS_BY_ID[example.campaign.id]).toBeDefined();
      expect(CAMPAIGN_GROUPS_BY_ID[example.group.id]).toBeDefined();
      expect(example.audienceLabel.trim().length).toBeGreaterThan(0);
    }
  });

  it("every example audienceSize is a positive integer", () => {
    for (const example of campaignRelationshipExamples) {
      expect(example.audienceSize).toBeGreaterThan(0);
      expect(Number.isInteger(example.audienceSize)).toBe(true);
    }
  });

  it("campaign and group IDs are consistent within each example", () => {
    for (const example of campaignRelationshipExamples) {
      expect(example.campaign.groupId).toBe(example.group.id);
    }
  });

  it("message links in each example belong to the correct campaign", () => {
    for (const example of campaignRelationshipExamples) {
      for (const link of example.messageLinks) {
        expect(link.campaignId).toBe(example.campaign.id);
      }
    }
  });
});
