/**
 * Typed execution contract for the team-analytics-dashboard tool.
 *
 * This declaration file documents the backend-facing (non-UI) inputs and
 * outputs consumed and produced by the service entry points in `services/`.
 * The services are plain `.mjs` modules; these types exist so callers,
 * reviewers, and editors can rely on a stable, machine-checkable contract
 * with no runtime dependency and no build step.
 */

/** Workload classification computed for each team member. */
export type MemberStatus = "active" | "overloaded" | "underutilized" | "away";

/** Health classification computed for each team snapshot. */
export type SnapshotStatus = "healthy" | "watch" | "needs-attention" | "blocked";

/** Reporting period for a dashboard report. */
export interface AnalyticsPeriod {
  /** ISO date, YYYY-MM-DD. */
  start: string;
  /** ISO date, YYYY-MM-DD. */
  end: string;
  /** Human-readable label, e.g. "Week of June 9". */
  label?: string;
}

/** A single member row supplied to generateDashboardReport. */
export interface DashboardMemberInput {
  memberId: string;
  name?: string;
  emailsReceived: number;
  emailsHandled: number;
  /** Null when the member was away for the whole period. */
  avgResponseTimeHours: number | null;
  openThreads: number;
  resolvedThreads: number;
  slaBreaches: number;
  /** Optional on input; always recomputed on output. */
  status?: MemberStatus;
}

/** Input payload for generateDashboardReport. */
export interface DashboardInput {
  tool?: string;
  version?: number;
  teamId: string;
  period: AnalyticsPeriod;
  members: DashboardMemberInput[];
}

/** A member row on the output, with a server-computed status. */
export interface DashboardMemberSnapshot extends DashboardMemberInput {
  status: MemberStatus;
}

/** Team-level rollup on the output. */
export interface DashboardSummary {
  totalEmailVolume: number;
  totalHandled: number;
  totalOpen: number;
  teamAvgResponseTimeHours: number | null;
  totalSlaBreaches: number;
  topPerformerId: string | null;
  bottleneckMemberId: string;
  reviewRequiredMemberIds: string[];
}

/** Output of generateDashboardReport. */
export interface DashboardReport {
  teamId: string;
  period: AnalyticsPeriod;
  members: DashboardMemberSnapshot[];
  summary: DashboardSummary;
}

/** A single source report supplied to generateSnapshots. */
export interface SourceReport {
  id: string;
  team: string;
  period: string;
  totalThreads: number;
  /** Null when source data is incomplete. */
  averageFirstResponseHours: number | null;
  openBacklog: number;
  hasCompleteSourceData: boolean;
}

/** A dashboard-ready snapshot produced by generateSnapshots. */
export interface AnalyticsSnapshot {
  id: string;
  team: string;
  period: string;
  status: SnapshotStatus;
  totalThreads: number;
  averageFirstResponseHours: number | null;
  openBacklog: number;
  sourceReportId: string;
  reviewRequired: boolean;
}

/** Stable error codes carried by AnalyticsError.code. */
export type AnalyticsErrorCode =
  | "INVALID_DASHBOARD_DATA"
  | "INVALID_MEMBERS"
  | "MEMBERS_LIMIT_EXCEEDED"
  | "INVALID_MEMBER_ITEM"
  | "INVALID_MEMBER_ID"
  | "INVALID_SOURCE_REPORTS"
  | "SOURCE_REPORTS_LIMIT_EXCEEDED"
  | "INVALID_SOURCE_REPORT_ITEM";

/** Error raised by the guards when an input violates the contract. */
export declare class AnalyticsError extends Error {
  code: AnalyticsErrorCode;
  constructor(code: AnalyticsErrorCode, message: string);
}

/** Non-UI service entry points. */
export declare function generateDashboardReport(data: DashboardInput): DashboardReport;
export declare function generateSnapshots(sourceReports: SourceReport[]): AnalyticsSnapshot[];
