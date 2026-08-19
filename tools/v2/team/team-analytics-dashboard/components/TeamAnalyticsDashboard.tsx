import React, { useRef } from "react";
import type {
  DashboardReport,
  AnalyticsSnapshot,
  MemberStatus,
  SnapshotStatus,
} from "../contract/analytics-contract";
import type { SortColumn } from "./MemberTable";
import { EmptyState } from "./EmptyState";
import { LoadingState } from "./LoadingState";
import { ErrorState } from "./ErrorState";
import { SuccessState } from "./SuccessState";
import { SummaryCards } from "./SummaryCards";
import { MemberTable } from "./MemberTable";
import { SnapshotList } from "./SnapshotList";

export interface TeamAnalyticsDashboardProps {
  report?: DashboardReport | null;
  snapshots?: AnalyticsSnapshot[] | null;
  loading?: boolean;
  error?: string | null;
  successMessage?: string | null;
  activeTab?: "members" | "snapshots";
  onTabChange?: (tab: "members" | "snapshots") => void;
  statusFilter?: "all" | MemberStatus;
  onStatusFilterChange?: (status: "all" | MemberStatus) => void;
  snapshotStatusFilter?: "all" | SnapshotStatus;
  onSnapshotStatusFilterChange?: (status: "all" | SnapshotStatus) => void;
  reviewRequiredOnly?: boolean;
  onReviewRequiredOnlyChange?: (only: boolean) => void;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  sortBy?: SortColumn;
  sortOrder?: "asc" | "desc";
  onSort?: (column: SortColumn) => void;
  selectedMemberId?: string | null;
  onSelectMember?: (memberId: string) => void;
  selectedSnapshotId?: string | null;
  onSelectSnapshot?: (snapshotId: string) => void;
  onClearFilters?: () => void;
  onRetry?: () => void;
  onLoadSampleData?: () => void;
  onDismissSuccess?: () => void;
}

const MEMBER_STATUS_OPTIONS: Array<{
  label: string;
  value: "all" | MemberStatus;
}> = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Overloaded", value: "overloaded" },
  { label: "Underutilized", value: "underutilized" },
  { label: "Away", value: "away" },
];

const SNAPSHOT_STATUS_OPTIONS: Array<{
  label: string;
  value: "all" | SnapshotStatus;
}> = [
  { label: "All", value: "all" },
  { label: "Healthy", value: "healthy" },
  { label: "Watch", value: "watch" },
  { label: "Needs Attention", value: "needs-attention" },
  { label: "Blocked", value: "blocked" },
];

/**
 * Primary UI Workflow component for Team Analytics Dashboard.
 *
 * Provides keyboard-accessible tabs, filtering, search, and sorting over Member Performance
 * and Team Snapshots data.
 * Adheres to accessibility best practices: clear headings, ARIA live regions, semantic controls,
 * and keyboard navigation support.
 */
export function TeamAnalyticsDashboard({
  report,
  snapshots = [],
  loading = false,
  error = null,
  successMessage = null,
  activeTab = "members",
  onTabChange,
  statusFilter = "all",
  onStatusFilterChange,
  snapshotStatusFilter = "all",
  onSnapshotStatusFilterChange,
  reviewRequiredOnly = false,
  onReviewRequiredOnlyChange,
  searchQuery = "",
  onSearchQueryChange,
  sortBy = "memberId",
  sortOrder = "asc",
  onSort,
  selectedMemberId = null,
  onSelectMember,
  selectedSnapshotId = null,
  onSelectSnapshot,
  onClearFilters,
  onRetry,
  onLoadSampleData,
  onDismissSuccess,
}: TeamAnalyticsDashboardProps) {
  const tabMembersRef = useRef<HTMLButtonElement | null>(null);
  const tabSnapshotsRef = useRef<HTMLButtonElement | null>(null);

  const handleTabKeyDown = (event: React.KeyboardEvent, targetTab: "members" | "snapshots") => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const nextTab = targetTab === "members" ? "snapshots" : "members";
      onTabChange?.(nextTab);
      if (nextTab === "members") {
        tabMembersRef.current?.focus();
      } else {
        tabSnapshotsRef.current?.focus();
      }
    }
  };

  const hasActiveFilters =
    statusFilter !== "all" ||
    snapshotStatusFilter !== "all" ||
    reviewRequiredOnly ||
    searchQuery.trim() !== "";

  const renderContent = () => {
    if (loading) {
      return <LoadingState message="Loading team analytics dashboard…" />;
    }

    if (error) {
      return <ErrorState message={error} onRetry={onRetry} />;
    }

    if (!report && (!snapshots || snapshots.length === 0)) {
      return (
        <EmptyState
          title="No team analytics loaded"
          description="Load sample team analytics data or select a reporting period to begin."
          actionLabel="Load sample data"
          onAction={onLoadSampleData}
        />
      );
    }

    if (activeTab === "snapshots") {
      const filteredSnapshots = (snapshots || []).filter((snapshot) => {
        if (snapshotStatusFilter !== "all" && snapshot.status !== snapshotStatusFilter) {
          return false;
        }
        if (reviewRequiredOnly && !snapshot.reviewRequired) {
          return false;
        }
        return true;
      });

      return (
        <div
          id="panel-snapshots"
          role="tabpanel"
          aria-labelledby="tab-snapshots"
          className="space-y-4"
        >
          <div className="border-border bg-card flex flex-wrap items-center justify-between gap-4 rounded-lg border p-3">
            <div
              role="group"
              aria-label="Filter snapshots by status"
              className="flex flex-wrap items-center gap-1.5"
            >
              {SNAPSHOT_STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={snapshotStatusFilter === opt.value}
                  onClick={() => onSnapshotStatusFilterChange?.(opt.value)}
                  className={`focus-visible:ring-primary rounded-md px-3 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${
                    snapshotStatusFilter === opt.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-pressed={reviewRequiredOnly}
                onClick={() => onReviewRequiredOnlyChange?.(!reviewRequiredOnly)}
                className={`focus-visible:ring-destructive rounded-md border px-3 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${
                  reviewRequiredOnly
                    ? "border-destructive bg-destructive text-destructive-foreground"
                    : "border-border bg-background hover:bg-muted text-foreground"
                }`}
              >
                Review Required Only
              </button>

              {hasActiveFilters && onClearFilters && (
                <button
                  type="button"
                  onClick={onClearFilters}
                  aria-label="Clear all filters"
                  className="text-muted-foreground hover:text-foreground text-xs underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

          <SnapshotList
            snapshots={filteredSnapshots}
            selectedSnapshotId={selectedSnapshotId}
            onSelectSnapshot={onSelectSnapshot}
          />
        </div>
      );
    }

    // Default: activeTab === "members"
    const allMembers = report?.members || [];
    const filteredMembers = allMembers.filter((member) => {
      if (statusFilter !== "all" && member.status !== statusFilter) {
        return false;
      }
      if (reviewRequiredOnly && member.slaBreaches === 0) {
        return false;
      }
      if (searchQuery.trim() !== "") {
        const query = searchQuery.trim().toLowerCase();
        const matchesId = member.memberId.toLowerCase().includes(query);
        const matchesName = member.name ? member.name.toLowerCase().includes(query) : false;
        if (!matchesId && !matchesName) return false;
      }
      return true;
    });

    const sortedMembers = [...filteredMembers].sort((a, b) => {
      const valA: string | number | null = a[sortBy] ?? null;
      const valB: string | number | null = b[sortBy] ?? null;

      if (sortBy === "avgResponseTimeHours") {
        if (valA === null && valB === null) return 0;
        if (valA === null) return 1;
        if (valB === null) return -1;
      }

      if (typeof valA === "string" && typeof valB === "string") {
        return sortOrder === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      const numA = typeof valA === "number" ? valA : 0;
      const numB = typeof valB === "number" ? valB : 0;
      return sortOrder === "asc" ? numA - numB : numB - numA;
    });

    return (
      <div id="panel-members" role="tabpanel" aria-labelledby="tab-members" className="space-y-6">
        {report?.summary && (
          <SummaryCards
            summary={report.summary}
            onFilterReviewRequired={() => onReviewRequiredOnlyChange?.(!reviewRequiredOnly)}
            reviewRequiredFilterActive={reviewRequiredOnly}
          />
        )}

        <div className="border-border bg-card flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-xs">
              <label htmlFor="member-search-input" className="sr-only">
                Search members by ID or name
              </label>
              <input
                id="member-search-input"
                type="search"
                aria-label="Search members by ID or name"
                placeholder="Search members..."
                value={searchQuery}
                onChange={(e) => onSearchQueryChange?.(e.target.value)}
                className="border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-primary w-full rounded-md border px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
              />
            </div>

            <div
              role="group"
              aria-label="Filter members by status"
              className="flex flex-wrap items-center gap-1.5"
            >
              {MEMBER_STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={statusFilter === opt.value}
                  onClick={() => onStatusFilterChange?.(opt.value)}
                  className={`focus-visible:ring-primary rounded-md px-3 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${
                    statusFilter === opt.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-pressed={reviewRequiredOnly}
              onClick={() => onReviewRequiredOnlyChange?.(!reviewRequiredOnly)}
              className={`focus-visible:ring-destructive rounded-md border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${
                reviewRequiredOnly
                  ? "border-destructive bg-destructive text-destructive-foreground"
                  : "border-border bg-background hover:bg-muted text-foreground"
              }`}
            >
              Review Required Only
            </button>

            {hasActiveFilters && onClearFilters && (
              <button
                type="button"
                onClick={onClearFilters}
                aria-label="Clear all member filters"
                className="text-muted-foreground hover:text-foreground text-xs underline"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {sortedMembers.length === 0 ? (
          <EmptyState
            title="No matching team members"
            description="No team members match the current search query or status filter."
            actionLabel={hasActiveFilters ? "Clear filters" : undefined}
            onAction={hasActiveFilters ? onClearFilters : undefined}
          />
        ) : (
          <MemberTable
            members={sortedMembers}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={onSort}
            selectedMemberId={selectedMemberId}
            onSelectMember={onSelectMember}
          />
        )}
      </div>
    );
  };

  return (
    <section
      aria-labelledby="team-analytics-dashboard-title"
      className="text-foreground mx-auto max-w-7xl space-y-6 p-4 md:p-6"
    >
      <header className="border-border flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 id="team-analytics-dashboard-title" className="text-2xl font-bold tracking-tight">
            Team Analytics Dashboard
          </h1>
          {report ? (
            <p className="text-muted-foreground mt-1 text-sm">
              Team: <span className="text-foreground font-semibold">{report.teamId}</span> — Period:{" "}
              <span className="text-foreground font-semibold">
                {report.period.label || `${report.period.start} to ${report.period.end}`}
              </span>
            </p>
          ) : (
            <p className="text-muted-foreground mt-1 text-sm">
              Performance metrics and team workload snapshots
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onLoadSampleData && (
            <button
              type="button"
              onClick={onLoadSampleData}
              aria-label="Load sample team analytics data"
              className="border-border bg-background hover:bg-muted focus-visible:ring-primary rounded-md border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              Load Sample Data
            </button>
          )}
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              aria-label="Refresh team analytics data"
              className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              Refresh
            </button>
          )}
        </div>
      </header>

      {successMessage && <SuccessState message={successMessage} onDismiss={onDismissSuccess} />}

      <nav
        role="tablist"
        aria-label="Dashboard view selection"
        className="border-border flex items-center gap-2 border-b"
      >
        <button
          ref={tabMembersRef}
          id="tab-members"
          role="tab"
          type="button"
          aria-selected={activeTab === "members"}
          aria-controls="panel-members"
          tabIndex={activeTab === "members" ? 0 : -1}
          onClick={() => onTabChange?.("members")}
          onKeyDown={(e) => handleTabKeyDown(e, "members")}
          className={`focus-visible:ring-primary -mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none ${
            activeTab === "members"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
          }`}
        >
          Member Workload
        </button>

        <button
          ref={tabSnapshotsRef}
          id="tab-snapshots"
          role="tab"
          type="button"
          aria-selected={activeTab === "snapshots"}
          aria-controls="panel-snapshots"
          tabIndex={activeTab === "snapshots" ? 0 : -1}
          onClick={() => onTabChange?.("snapshots")}
          onKeyDown={(e) => handleTabKeyDown(e, "snapshots")}
          className={`focus-visible:ring-primary -mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none ${
            activeTab === "snapshots"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
          }`}
        >
          Team Snapshots
        </button>
      </nav>

      <main>{renderContent()}</main>
    </section>
  );
}
