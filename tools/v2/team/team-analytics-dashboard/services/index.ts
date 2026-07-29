/**
 * Service index exporting typed entry points for team-analytics-dashboard.
 */
import { generateDashboardReport as _generateDashboardReport } from "./analytics-dashboard.service.mjs";
import { generateSnapshots as _generateSnapshots } from "./analytics-snapshot.service.mjs";
import type {
  DashboardInput,
  DashboardReport,
  SourceReport,
  AnalyticsSnapshot,
} from "../contract/analytics-contract";

export const generateDashboardReport: (data: DashboardInput) => DashboardReport =
  _generateDashboardReport;

export const generateSnapshots: (sourceReports: SourceReport[]) => AnalyticsSnapshot[] =
  _generateSnapshots;

export type * from "../contract/analytics-contract";
