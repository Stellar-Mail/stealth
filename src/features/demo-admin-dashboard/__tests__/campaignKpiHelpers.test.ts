import { describe, expect, it } from "vitest";
import { CAMPAIGN_KPI_DEFINITIONS } from "../fixtures/campaignKpiFixtures";
import {
  computeKpiProgress,
  getKpiById,
  getKpisForCampaign,
  isKpiMet,
  sortKpisByMetric,
  validateCampaignKpiDefinition,
} from "../utils/campaignKpiHelpers";
import type { CampaignKpiDefinition, KpiMetricKind } from "../types/campaignKpi";

const ALL_METRIC_KINDS: KpiMetricKind[] = [
  "opens",
  "approvals",
  "replies",
  "refunds",
  "proof_inspections",
  "conversions",
];

describe("CAMPAIGN_KPI_DEFINITIONS fixture", () => {
  it("contains 18 items", () => {
    expect(CAMPAIGN_KPI_DEFINITIONS).toHaveLength(18);
  });

  it("every item has required string fields", () => {
    for (const kpi of CAMPAIGN_KPI_DEFINITIONS) {
      expect(typeof kpi.id).toBe("string");
      expect(kpi.id.length).toBeGreaterThan(0);
      expect(typeof kpi.campaignId).toBe("string");
      expect(kpi.campaignId.length).toBeGreaterThan(0);
      expect(typeof kpi.label).toBe("string");
      expect(kpi.label.length).toBeGreaterThan(0);
      expect(typeof kpi.description).toBe("string");
      expect(kpi.description.length).toBeGreaterThan(0);
      expect(typeof kpi.windowLabel).toBe("string");
      expect(kpi.windowLabel.length).toBeGreaterThan(0);
    }
  });

  it("all ids are unique", () => {
    const ids = CAMPAIGN_KPI_DEFINITIONS.map((k) => k.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every item has target > 0 and currentValue >= 0", () => {
    for (const kpi of CAMPAIGN_KPI_DEFINITIONS) {
      expect(kpi.target).toBeGreaterThan(0);
      expect(kpi.currentValue).toBeGreaterThanOrEqual(0);
    }
  });

  it("all six metric kinds appear at least once", () => {
    const present = new Set(CAMPAIGN_KPI_DEFINITIONS.map((k) => k.metric));
    for (const kind of ALL_METRIC_KINDS) {
      expect(present.has(kind)).toBe(true);
    }
  });

  it("covers expected campaign ids", () => {
    const campaignIds = new Set(CAMPAIGN_KPI_DEFINITIONS.map((k) => k.campaignId));
    expect(campaignIds.has("campaign-onboarding-2026")).toBe(true);
    expect(campaignIds.has("campaign-stellar-launch-2026")).toBe(true);
    expect(campaignIds.has("campaign-investor-nurture")).toBe(true);
  });
});

describe("computeKpiProgress", () => {
  it("returns 0.5 when currentValue is half of target", () => {
    const kpi = makeKpi({ target: 100, currentValue: 50 });
    expect(computeKpiProgress(kpi)).toBe(0.5);
  });

  it("clamps to 1 when currentValue exceeds target", () => {
    const kpi = makeKpi({ target: 100, currentValue: 150 });
    expect(computeKpiProgress(kpi)).toBe(1);
  });

  it("returns 1 when currentValue equals target", () => {
    const kpi = makeKpi({ target: 200, currentValue: 200 });
    expect(computeKpiProgress(kpi)).toBe(1);
  });

  it("returns 0 when target is 0 (guard against division by zero)", () => {
    const kpi = makeKpi({ target: 0, currentValue: 50 });
    expect(computeKpiProgress(kpi)).toBe(0);
  });

  it("returns 0 when currentValue is 0", () => {
    const kpi = makeKpi({ target: 100, currentValue: 0 });
    expect(computeKpiProgress(kpi)).toBe(0);
  });
});

describe("isKpiMet", () => {
  it("returns true when currentValue equals target", () => {
    expect(isKpiMet(makeKpi({ target: 100, currentValue: 100 }))).toBe(true);
  });

  it("returns true when currentValue exceeds target", () => {
    expect(isKpiMet(makeKpi({ target: 100, currentValue: 101 }))).toBe(true);
  });

  it("returns false when currentValue is below target", () => {
    expect(isKpiMet(makeKpi({ target: 100, currentValue: 99 }))).toBe(false);
  });
});

describe("getKpiById", () => {
  it("returns the matching item", () => {
    const result = getKpiById(CAMPAIGN_KPI_DEFINITIONS, "kpi-onboarding-opens");
    expect(result).toBeDefined();
    expect(result?.metric).toBe("opens");
    expect(result?.campaignId).toBe("campaign-onboarding-2026");
  });

  it("returns undefined for an unknown id", () => {
    expect(getKpiById(CAMPAIGN_KPI_DEFINITIONS, "does-not-exist")).toBeUndefined();
  });
});

describe("getKpisForCampaign", () => {
  it("returns all six KPIs for the onboarding campaign", () => {
    const result = getKpisForCampaign(CAMPAIGN_KPI_DEFINITIONS, "campaign-onboarding-2026");
    expect(result).toHaveLength(6);
    expect(result.every((k) => k.campaignId === "campaign-onboarding-2026")).toBe(true);
  });

  it("returns all six KPIs for the stellar launch campaign", () => {
    const result = getKpisForCampaign(CAMPAIGN_KPI_DEFINITIONS, "campaign-stellar-launch-2026");
    expect(result).toHaveLength(6);
  });

  it("returns empty array for an unknown campaign id", () => {
    expect(getKpisForCampaign(CAMPAIGN_KPI_DEFINITIONS, "unknown")).toHaveLength(0);
  });
});

describe("sortKpisByMetric", () => {
  it("does not mutate the input array", () => {
    const input = [...CAMPAIGN_KPI_DEFINITIONS];
    const original = input.map((k) => k.id);
    sortKpisByMetric(input);
    expect(input.map((k) => k.id)).toEqual(original);
  });

  it("returns a new array with the same length", () => {
    const result = sortKpisByMetric(CAMPAIGN_KPI_DEFINITIONS);
    expect(result).toHaveLength(CAMPAIGN_KPI_DEFINITIONS.length);
  });

  it("orders by canonical metric kind sequence", () => {
    const onboarding = getKpisForCampaign(CAMPAIGN_KPI_DEFINITIONS, "campaign-onboarding-2026");
    const sorted = sortKpisByMetric(onboarding);
    expect(sorted.map((k) => k.metric)).toEqual(ALL_METRIC_KINDS);
  });
});

describe("validateCampaignKpiDefinition", () => {
  it("returns no issues for a valid fixture item", () => {
    const kpi = CAMPAIGN_KPI_DEFINITIONS[0];
    expect(validateCampaignKpiDefinition(kpi)).toHaveLength(0);
  });

  it("returns an error when id is empty", () => {
    const issues = validateCampaignKpiDefinition(makeKpi({ id: "" }));
    const ids = issues.map((i) => i.fieldPath);
    expect(ids).toContain("id");
    expect(issues.some((i) => i.severity === "error")).toBe(true);
  });

  it("returns an error when campaignId is empty", () => {
    const issues = validateCampaignKpiDefinition(makeKpi({ campaignId: "" }));
    expect(issues.some((i) => i.fieldPath === "campaignId")).toBe(true);
  });

  it("returns an error when target is 0", () => {
    const issues = validateCampaignKpiDefinition(makeKpi({ target: 0 }));
    expect(issues.some((i) => i.fieldPath === "target")).toBe(true);
  });

  it("returns an error when target is negative", () => {
    const issues = validateCampaignKpiDefinition(makeKpi({ target: -1 }));
    expect(issues.some((i) => i.fieldPath === "target")).toBe(true);
  });

  it("returns an error when currentValue is negative", () => {
    const issues = validateCampaignKpiDefinition(makeKpi({ currentValue: -5 }));
    expect(issues.some((i) => i.fieldPath === "currentValue")).toBe(true);
  });

  it("returns an error when metric is not a valid KpiMetricKind", () => {
    const issues = validateCampaignKpiDefinition(makeKpi({ metric: "bounces" as KpiMetricKind }));
    expect(issues.some((i) => i.fieldPath === "metric")).toBe(true);
  });

  it("returns multiple errors for a fully invalid KPI", () => {
    const issues = validateCampaignKpiDefinition(
      makeKpi({ id: "", campaignId: "", target: 0, currentValue: -1 }),
    );
    expect(issues.length).toBeGreaterThanOrEqual(4);
  });
});

// ── helpers ──────────────────────────────────────────────────────────────────

function makeKpi(overrides: Partial<CampaignKpiDefinition> = {}): CampaignKpiDefinition {
  return {
    id: "kpi-test",
    campaignId: "campaign-test",
    metric: "opens",
    label: "Test Opens",
    description: "Test metric",
    unit: "count",
    target: 100,
    currentValue: 50,
    status: "on-track",
    trend: "up",
    windowLabel: "campaign total",
    ...overrides,
  };
}
