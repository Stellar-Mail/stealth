/**
 * Fixture exports for team-analytics-dashboard.
 */
import sampleAnalyticsDataJson from "./sample-analytics-data.json";
import sampleTeamAnalyticsJson from "./sample-team-analytics.json";
import type {
  DashboardInput,
  SourceReport,
  AnalyticsSnapshot,
  DashboardReport,
} from "../contract/analytics-contract";
import { generateDashboardReport, generateSnapshots } from "../services";

export const sampleDashboardInput = sampleAnalyticsDataJson as unknown as DashboardInput;

export const sampleSourceReports = (sampleTeamAnalyticsJson.sourceReports ||
  []) as unknown as SourceReport[];

export const sampleExpectedSnapshots = (sampleTeamAnalyticsJson.expectedSnapshots ||
  []) as unknown as AnalyticsSnapshot[];

export const sampleDashboardReport: DashboardReport = generateDashboardReport(sampleDashboardInput);

export const sampleAnalyticsSnapshots: AnalyticsSnapshot[] = generateSnapshots(sampleSourceReports);
