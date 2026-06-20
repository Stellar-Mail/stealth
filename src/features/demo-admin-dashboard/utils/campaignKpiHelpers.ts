import type { ValidationIssue } from "../validation-types";
import type { CampaignKpiDefinition, KpiMetricKind, KpiTrend } from "../types/campaignKpi";

const KPI_METRIC_KIND_ORDER: KpiMetricKind[] = [
  "opens",
  "approvals",
  "replies",
  "refunds",
  "proof_inspections",
  "conversions",
];

const VALID_METRIC_KINDS = new Set<string>(KPI_METRIC_KIND_ORDER);

export function getKpiById(
  kpis: CampaignKpiDefinition[],
  id: string,
): CampaignKpiDefinition | undefined {
  return kpis.find((k) => k.id === id);
}

export function getKpisForCampaign(
  kpis: CampaignKpiDefinition[],
  campaignId: string,
): CampaignKpiDefinition[] {
  return kpis.filter((k) => k.campaignId === campaignId);
}

/** Returns progress as a ratio in [0, 1]. A target of 0 returns 0. */
export function computeKpiProgress(kpi: CampaignKpiDefinition): number {
  if (kpi.target <= 0) return 0;
  return Math.min(1, kpi.currentValue / kpi.target);
}

export function isKpiMet(kpi: CampaignKpiDefinition): boolean {
  return kpi.currentValue >= kpi.target;
}

/** Returns a new sorted array ordered by canonical KpiMetricKind sequence. Does not mutate input. */
export function sortKpisByMetric(kpis: CampaignKpiDefinition[]): CampaignKpiDefinition[] {
  return [...kpis].sort(
    (a, b) => KPI_METRIC_KIND_ORDER.indexOf(a.metric) - KPI_METRIC_KIND_ORDER.indexOf(b.metric),
  );
}

const TREND_LABELS: Record<KpiTrend, string> = {
  up: "↑ Up",
  down: "↓ Down",
  stable: "→ Stable",
};

export function formatKpiTrend(trend: KpiTrend): string {
  return TREND_LABELS[trend];
}

export function validateCampaignKpiDefinition(kpi: CampaignKpiDefinition): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const datasetId = kpi.campaignId || "unknown-campaign";

  if (!kpi.id || kpi.id.trim() === "") {
    issues.push({
      id: "kpi-err-id-empty",
      severity: "error",
      fieldPath: "id",
      message: "KPI id must not be empty.",
      datasetId,
      recordId: kpi.id || undefined,
      hint: 'Provide a stable kebab-case identifier, e.g. "kpi-onboarding-opens".',
    });
  }

  if (!kpi.campaignId || kpi.campaignId.trim() === "") {
    issues.push({
      id: "kpi-err-campaign-id-empty",
      severity: "error",
      fieldPath: "campaignId",
      message: "KPI campaignId must not be empty.",
      datasetId,
      recordId: kpi.id || undefined,
      hint: "Set campaignId to the parent campaign's identifier.",
    });
  }

  if (!VALID_METRIC_KINDS.has(kpi.metric)) {
    issues.push({
      id: "kpi-err-metric-invalid",
      severity: "error",
      fieldPath: "metric",
      message: `"${kpi.metric}" is not a valid KpiMetricKind.`,
      datasetId,
      recordId: kpi.id || undefined,
      hint: `Use one of: ${KPI_METRIC_KIND_ORDER.join(", ")}.`,
    });
  }

  if (kpi.target <= 0) {
    issues.push({
      id: "kpi-err-target-nonpositive",
      severity: "error",
      fieldPath: "target",
      message: "KPI target must be greater than 0.",
      datasetId,
      recordId: kpi.id || undefined,
      hint: "Set target to a positive integer representing the campaign goal.",
    });
  }

  if (kpi.currentValue < 0) {
    issues.push({
      id: "kpi-err-current-value-negative",
      severity: "error",
      fieldPath: "currentValue",
      message: "KPI currentValue must not be negative.",
      datasetId,
      recordId: kpi.id || undefined,
      hint: "Set currentValue to 0 or a positive integer.",
    });
  }

  return issues;
}
