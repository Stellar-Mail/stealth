/**
 * Team Analytics Dashboard - Demo & Usage Setup
 *
 * Demonstrates how to use the Team Analytics Dashboard tool in a local
 * or testing environment.
 */
import React from "react";
import { TeamAnalyticsDashboard } from "./components";
import { useTeamAnalytics } from "./hooks";
import { sampleDashboardReport, sampleAnalyticsSnapshots } from "./fixtures";

/**
 * Interactive Demo Component with state simulation buttons.
 */
export function TeamAnalyticsDashboardDemo() {
  const {
    report,
    snapshots,
    loading,
    error,
    successMessage,
    activeTab,
    statusFilter,
    snapshotStatusFilter,
    reviewRequiredOnly,
    searchQuery,
    sortBy,
    sortOrder,
    selectedMemberId,
    selectedSnapshotId,
    setActiveTab,
    setStatusFilter,
    setSnapshotStatusFilter,
    setReviewRequiredOnly,
    setSearchQuery,
    handleSort,
    setSelectedMemberId,
    setSelectedSnapshotId,
    handleClearFilters,
    handleLoadSampleFixtures,
    handleRefresh,
    handleDismissSuccess,
    setLoading,
    setError,
    setReport,
    setSnapshots,
    setSuccessMessage,
  } = useTeamAnalytics();

  const simulateLoading = () => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
  };

  const simulateError = () => {
    setLoading(false);
    setError("Failed to fetch analytics from source mail servers. Connection timed out.");
    setSuccessMessage(null);
  };

  const simulateEmpty = () => {
    setLoading(false);
    setError(null);
    setReport(null);
    setSnapshots([]);
    setSuccessMessage(null);
  };

  const resetData = () => {
    handleLoadSampleFixtures();
  };

  return (
    <div className="bg-background text-foreground min-h-screen space-y-4 pb-12">
      <div className="border-border bg-muted/30 mx-auto max-w-7xl border-b px-4 py-3 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
            Demo State Controls:
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={resetData}
              className="border-border bg-background hover:bg-muted rounded border px-2.5 py-1 text-xs font-medium"
            >
              Normal State
            </button>
            <button
              type="button"
              onClick={simulateLoading}
              className="border-border bg-background hover:bg-muted rounded border px-2.5 py-1 text-xs font-medium"
            >
              Simulate Loading
            </button>
            <button
              type="button"
              onClick={simulateError}
              className="border-border bg-background hover:bg-muted rounded border px-2.5 py-1 text-xs font-medium"
            >
              Simulate Error
            </button>
            <button
              type="button"
              onClick={simulateEmpty}
              className="border-border bg-background hover:bg-muted rounded border px-2.5 py-1 text-xs font-medium"
            >
              Simulate Empty
            </button>
          </div>
        </div>
      </div>

      <TeamAnalyticsDashboard
        report={report}
        snapshots={snapshots}
        loading={loading}
        error={error}
        successMessage={successMessage}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        snapshotStatusFilter={snapshotStatusFilter}
        onSnapshotStatusFilterChange={setSnapshotStatusFilter}
        reviewRequiredOnly={reviewRequiredOnly}
        onReviewRequiredOnlyChange={setReviewRequiredOnly}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        selectedMemberId={selectedMemberId}
        onSelectMember={setSelectedMemberId}
        selectedSnapshotId={selectedSnapshotId}
        onSelectSnapshot={setSelectedSnapshotId}
        onClearFilters={handleClearFilters}
        onRetry={handleRefresh}
        onLoadSampleData={handleLoadSampleFixtures}
        onDismissSuccess={handleDismissSuccess}
      />
    </div>
  );
}

/**
 * Minimal example rendering TeamAnalyticsDashboard with sample report and snapshots.
 */
export function MinimalExample() {
  return (
    <TeamAnalyticsDashboard report={sampleDashboardReport} snapshots={sampleAnalyticsSnapshots} />
  );
}
