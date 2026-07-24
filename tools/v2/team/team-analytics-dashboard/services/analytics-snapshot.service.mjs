import { validateSourceReports } from "../guards/analytics-guards.mjs";

const HEALTHY_BACKLOG_THRESHOLD = 20;
const WATCH_BACKLOG_THRESHOLD = 30;
const HIGH_RESPONSE_TIME_THRESHOLD = 8;
const MEDIUM_RESPONSE_TIME_THRESHOLD = 4;

function computeSnapshotStatus(report) {
  if (!report.hasCompleteSourceData) {
    return "blocked";
  }

  if (
    report.openBacklog >= WATCH_BACKLOG_THRESHOLD &&
    report.averageFirstResponseHours >= HIGH_RESPONSE_TIME_THRESHOLD
  ) {
    return "needs-attention";
  }

  if (
    report.openBacklog >= HEALTHY_BACKLOG_THRESHOLD ||
    report.averageFirstResponseHours >= MEDIUM_RESPONSE_TIME_THRESHOLD
  ) {
    return "watch";
  }

  return "healthy";
}

function requiresReview(snapshot) {
  return snapshot.status === "blocked" || snapshot.status === "needs-attention";
}

function buildSnapshot(report) {
  const status = computeSnapshotStatus(report);
  return {
    id: `snapshot-${report.id.replace(/^report-/, "")}`,
    team: report.team,
    period: report.period,
    status,
    totalThreads: report.totalThreads,
    averageFirstResponseHours: report.hasCompleteSourceData
      ? report.averageFirstResponseHours
      : null,
    openBacklog: report.openBacklog,
    sourceReportId: report.id,
    reviewRequired: requiresReview({ status }),
  };
}

/**
 * @param {import("../contract/analytics-contract").SourceReport[]} sourceReports
 * @returns {import("../contract/analytics-contract").AnalyticsSnapshot[]}
 */
export function generateSnapshots(sourceReports) {
  validateSourceReports(sourceReports);
  return sourceReports.map(buildSnapshot);
}
