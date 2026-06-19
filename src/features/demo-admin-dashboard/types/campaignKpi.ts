export type KpiMetricKind =
  | "opens"
  | "approvals"
  | "replies"
  | "refunds"
  | "proof_inspections"
  | "conversions";

export type KpiStatus = "on-track" | "at-risk" | "met" | "missed";

export type KpiTrend = "up" | "down" | "stable";

export type KpiUnit = "count" | "percent" | "rate";

export interface CampaignKpiDefinition {
  id: string;
  campaignId: string;
  metric: KpiMetricKind;
  label: string;
  description: string;
  unit: KpiUnit;
  target: number;
  currentValue: number;
  status: KpiStatus;
  trend: KpiTrend;
  /** e.g. "campaign total", "last 7 days" */
  windowLabel: string;
}
