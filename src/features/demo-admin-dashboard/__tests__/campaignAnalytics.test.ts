import { describe, expect, it } from "vitest";
import { formatKpiTrend } from "../utils/campaignKpiHelpers";
import { KPI_TREND_TOKENS, getKpiTrendToken } from "../constants/displayTokens";
import { getAdminEmptyStatePreset } from "../constants/adminEmptyStates";
import type { KpiTrend } from "../types/campaignKpi";

const ALL_TREND_KINDS: KpiTrend[] = ["up", "down", "stable"];

describe("formatKpiTrend", () => {
  it('returns "↑ Up" for trend "up"', () => {
    expect(formatKpiTrend("up")).toBe("↑ Up");
  });

  it('returns "↓ Down" for trend "down"', () => {
    expect(formatKpiTrend("down")).toBe("↓ Down");
  });

  it('returns "→ Stable" for trend "stable"', () => {
    expect(formatKpiTrend("stable")).toBe("→ Stable");
  });
});

describe("KPI_TREND_TOKENS", () => {
  it("covers all three trend kinds", () => {
    for (const trend of ALL_TREND_KINDS) {
      expect(KPI_TREND_TOKENS[trend]).toBeDefined();
    }
  });

  it("each token has required display fields", () => {
    for (const trend of ALL_TREND_KINDS) {
      const token = KPI_TREND_TOKENS[trend];
      expect(typeof token.bg).toBe("string");
      expect(typeof token.text).toBe("string");
      expect(typeof token.border).toBe("string");
      expect(typeof token.label).toBe("string");
      expect(token.label.length).toBeGreaterThan(0);
    }
  });
});

describe("getKpiTrendToken", () => {
  it('returns emerald text for "up"', () => {
    expect(getKpiTrendToken("up").text).toBe("text-emerald-400");
  });

  it('returns rose text for "down"', () => {
    expect(getKpiTrendToken("down").text).toBe("text-rose-400");
  });

  it('returns muted text for "stable"', () => {
    expect(getKpiTrendToken("stable").text).toBe("text-muted-foreground");
  });

  it("returns the same object as KPI_TREND_TOKENS direct lookup", () => {
    for (const trend of ALL_TREND_KINDS) {
      expect(getKpiTrendToken(trend)).toBe(KPI_TREND_TOKENS[trend]);
    }
  });
});

describe('AdminEmptyState "kpis" preset', () => {
  it('preset title is "No analytics yet"', () => {
    expect(getAdminEmptyStatePreset("kpis").title).toBe("No analytics yet");
  });

  it("preset description is defined and non-empty", () => {
    const preset = getAdminEmptyStatePreset("kpis");
    expect(typeof preset.description).toBe("string");
    expect(preset.description.length).toBeGreaterThan(0);
  });

  it("preset ctaLabel is defined", () => {
    const preset = getAdminEmptyStatePreset("kpis");
    expect(preset.ctaLabel).toBeDefined();
  });
});
