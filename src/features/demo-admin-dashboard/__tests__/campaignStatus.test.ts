import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_STATUSES,
  INITIAL_CAMPAIGN_STATUS,
  TERMINAL_STATUSES,
  type CampaignStatus,
  type CampaignStatusRecord,
} from "../types/campaignStatus";
import {
  getAllowedTransitions,
  canTransitionTo,
  validateCampaignStatusTransition,
  isTerminal,
  isInitial,
} from "../helpers/campaignStatusTransitions";
import {
  demoCampaignStatusRecords,
  getCampaignStatusRecordById,
  getCampaignsByStatus,
} from "../fixtures/campaignStatusFixtures";
import { CAMPAIGN_STATUS_TOKENS } from "../constants/displayTokens";

describe("CampaignStatus type", () => {
  it("should define all six statuses", () => {
    expect(CAMPAIGN_STATUSES).toEqual([
      "draft",
      "ready",
      "active",
      "paused",
      "archived",
      "failed",
    ]);
  });

  it("should start from draft", () => {
    expect(INITIAL_CAMPAIGN_STATUS).toBe("draft");
  });

  it("should have archived as the only terminal status", () => {
    expect(TERMINAL_STATUSES).toEqual(["archived"]);
  });
});

describe("CAMPAIGN_STATUS_TOKENS", () => {
  it("should define tokens for all six statuses", () => {
    for (const s of CAMPAIGN_STATUSES) {
      expect(CAMPAIGN_STATUS_TOKENS[s]).toBeDefined();
      expect(CAMPAIGN_STATUS_TOKENS[s].label).toBeDefined();
      expect(CAMPAIGN_STATUS_TOKENS[s].bg).toBeDefined();
      expect(CAMPAIGN_STATUS_TOKENS[s].text).toBeDefined();
      expect(CAMPAIGN_STATUS_TOKENS[s].border).toBeDefined();
    }
  });
});

describe("canTransitionTo", () => {
  const cases: [CampaignStatus, CampaignStatus, boolean][] = [
    ["draft", "ready", true],
    ["draft", "archived", true],
    ["draft", "active", false],
    ["draft", "paused", false],
    ["draft", "failed", false],

    ["ready", "active", true],
    ["ready", "draft", true],
    ["ready", "archived", true],
    ["ready", "paused", false],
    ["ready", "failed", false],

    ["active", "paused", true],
    ["active", "archived", true],
    ["active", "failed", true],
    ["active", "draft", false],
    ["active", "ready", false],

    ["paused", "active", true],
    ["paused", "archived", true],
    ["paused", "failed", true],
    ["paused", "draft", false],
    ["paused", "ready", false],

    ["archived", "draft", false],
    ["archived", "ready", false],
    ["archived", "active", false],
    ["archived", "paused", false],
    ["archived", "failed", false],

    ["failed", "draft", true],
    ["failed", "archived", true],
    ["failed", "ready", false],
    ["failed", "active", false],
    ["failed", "paused", false],
  ];

  it.each(cases)("canTransitionFrom(%s → %s) should be %s", (from, to, expected) => {
    expect(canTransitionTo(from, to)).toBe(expected);
  });
});

describe("getAllowedTransitions", () => {
  it("should return transitions from draft", () => {
    const transitions = getAllowedTransitions("draft");
    expect(transitions).toHaveLength(2);
    expect(transitions.map((t) => t.to)).toEqual(["ready", "archived"]);
  });

  it("should return transitions from active", () => {
    const transitions = getAllowedTransitions("active");
    expect(transitions).toHaveLength(3);
    expect(transitions.map((t) => t.to)).toEqual(["paused", "archived", "failed"]);
  });

  it("should return empty for terminal status", () => {
    expect(getAllowedTransitions("archived")).toEqual([]);
  });

  it("should include transition metadata labels", () => {
    const transitions = getAllowedTransitions("failed");
    expect(transitions).toHaveLength(2);
    expect(transitions[0].label).toBe("Retry");
    expect(transitions[1].label).toBe("Archive Failed");
  });
});

describe("validateCampaignStatusTransition", () => {
  it("should reject same-status transition", () => {
    const result = validateCampaignStatusTransition("draft", "draft");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("already set");
  });

  it("should reject transition from terminal status", () => {
    const result = validateCampaignStatusTransition("archived", "draft");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("terminal");
  });

  it("should reject invalid transition", () => {
    const result = validateCampaignStatusTransition("draft", "active");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("not allowed");
  });

  it("should accept valid transition", () => {
    const result = validateCampaignStatusTransition("draft", "ready");
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });
});

describe("isTerminal / isInitial", () => {
  it("should identify archived as terminal", () => {
    expect(isTerminal("archived")).toBe(true);
  });

  it("should not identify other statuses as terminal", () => {
    for (const s of ["draft", "ready", "active", "paused", "failed"] as CampaignStatus[]) {
      expect(isTerminal(s)).toBe(false);
    }
  });

  it("should identify draft as initial", () => {
    expect(isInitial("draft")).toBe(true);
  });

  it("should not identify other statuses as initial", () => {
    for (const s of ["ready", "active", "paused", "archived", "failed"] as CampaignStatus[]) {
      expect(isInitial(s)).toBe(false);
    }
  });
});

describe("demoCampaignStatusRecords", () => {
  it("should provide at least one record per status", () => {
    for (const s of CAMPAIGN_STATUSES) {
      const records = getCampaignsByStatus(s);
      expect(records.length).toBeGreaterThan(0);
    }
  });

  it("should have valid statuses on all records", () => {
    for (const record of demoCampaignStatusRecords) {
      expect(CAMPAIGN_STATUSES).toContain(record.status);
    }
  });

  it("should have unique ids", () => {
    const ids = demoCampaignStatusRecords.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("should provide consistent metadata", () => {
    for (const record of demoCampaignStatusRecords) {
      expect(record.name).toBeDefined();
      expect(record.description).toBeDefined();
      expect(record.tags).toBeInstanceOf(Array);
      expect(record.createdAt).toBeDefined();
      expect(record.updatedAt).toBeDefined();
    }
  });

  it("should find a record by id", () => {
    const found = getCampaignStatusRecordById("camp-active-01");
    expect(found).toBeDefined();
    expect(found!.name).toBe("Welcome Onboarding Series");
  });

  it("should return undefined for unknown id", () => {
    expect(getCampaignStatusRecordById("nonexistent")).toBeUndefined();
  });

  it("should filter by status", () => {
    const drafts = getCampaignsByStatus("draft");
    expect(drafts.every((r) => r.status === "draft")).toBe(true);
  });
});
