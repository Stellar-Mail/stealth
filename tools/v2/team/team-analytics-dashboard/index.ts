/**
 * Team Analytics Dashboard Tool - Main Export
 *
 * Self-contained V2 team tool that surfaces per-member performance metrics
 * and team workload snapshots.
 */

// Components
export {
  TeamAnalyticsDashboard,
  EmptyState,
  LoadingState,
  ErrorState,
  SuccessState,
  SummaryCards,
  MemberTable,
  SnapshotList,
} from "./components";

export type {
  TeamAnalyticsDashboardProps,
  EmptyStateProps,
  LoadingStateProps,
  ErrorStateProps,
  SuccessStateProps,
  SummaryCardsProps,
  MemberTableProps,
  SortColumn,
  SnapshotListProps,
} from "./components";

// Hooks
export { useTeamAnalytics } from "./hooks";
export type { UseTeamAnalyticsOptions } from "./hooks";

// Services
export { generateDashboardReport, generateSnapshots } from "./services";
export type * from "./contract/analytics-contract";

// Fixtures
export {
  sampleDashboardInput,
  sampleSourceReports,
  sampleExpectedSnapshots,
  sampleDashboardReport,
  sampleAnalyticsSnapshots,
} from "./fixtures";

// Demo
export { TeamAnalyticsDashboardDemo, MinimalExample } from "./demo";
