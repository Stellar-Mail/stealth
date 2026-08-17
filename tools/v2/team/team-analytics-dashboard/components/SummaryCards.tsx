import React from "react";
import type { DashboardSummary } from "../contract/analytics-contract";

export interface SummaryCardsProps {
  summary: DashboardSummary;
  onFilterReviewRequired?: () => void;
  reviewRequiredFilterActive?: boolean;
}

/**
 * Accessible Summary Cards component for Team Analytics Dashboard.
 *
 * Displays team-wide totals, response time averages, and key highlights (Top Performer, Bottleneck Member,
 * and Review Required alerts).
 * Handles away / null response times by displaying "N/A" instead of 0.
 */
export function SummaryCards({
  summary,
  onFilterReviewRequired,
  reviewRequiredFilterActive = false,
}: SummaryCardsProps) {
  const avgResponseDisplay =
    summary.teamAvgResponseTimeHours !== null ? `${summary.teamAvgResponseTimeHours}h` : "N/A";

  const hasReviewRequired = summary.reviewRequiredMemberIds.length > 0;

  return (
    <section aria-labelledby="analytics-summary-heading" className="space-y-4">
      <h2 id="analytics-summary-heading" className="sr-only">
        Team Analytics Summary
      </h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="border-border bg-card text-card-foreground rounded-lg border p-4 shadow-sm">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
            Email Volume
          </p>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold">{summary.totalEmailVolume}</span>
            <span className="text-muted-foreground text-xs">{summary.totalHandled} handled</span>
          </div>
        </div>

        <div className="border-border bg-card text-card-foreground rounded-lg border p-4 shadow-sm">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
            Open Threads
          </p>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold">{summary.totalOpen}</span>
            <span className="text-muted-foreground text-xs">Active Backlog</span>
          </div>
        </div>

        <div className="border-border bg-card text-card-foreground rounded-lg border p-4 shadow-sm">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
            Avg Response Time
          </p>
          <div className="mt-1 flex items-baseline justify-between">
            <span
              className="text-2xl font-bold"
              aria-label={
                summary.teamAvgResponseTimeHours === null
                  ? "Not applicable"
                  : `${summary.teamAvgResponseTimeHours} hours`
              }
            >
              {avgResponseDisplay}
            </span>
            <span className="text-muted-foreground text-xs">Team average</span>
          </div>
        </div>

        <div className="border-border bg-card text-card-foreground rounded-lg border p-4 shadow-sm">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
            SLA Breaches
          </p>
          <div className="mt-1 flex items-baseline justify-between">
            <span
              className={`text-2xl font-bold ${
                summary.totalSlaBreaches > 0 ? "text-destructive" : ""
              }`}
            >
              {summary.totalSlaBreaches}
            </span>
            <span className="text-muted-foreground text-xs">&gt; 4 hour SLA</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="border-border bg-card text-card-foreground flex items-center justify-between rounded-lg border p-4 shadow-sm">
          <div>
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
              Top Performer
            </p>
            <p className="mt-1 text-base font-semibold">
              {summary.topPerformerId ? summary.topPerformerId : "None"}
            </p>
          </div>
          <span aria-hidden="true" className="text-2xl">
            🏆
          </span>
        </div>

        <div className="border-border bg-card text-card-foreground flex items-center justify-between rounded-lg border p-4 shadow-sm">
          <div>
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
              Bottleneck Member
            </p>
            <p className="mt-1 text-base font-semibold">
              {summary.bottleneckMemberId ? summary.bottleneckMemberId : "None"}
            </p>
          </div>
          <span aria-hidden="true" className="text-2xl">
            ⚡
          </span>
        </div>
      </div>

      {hasReviewRequired && (
        <div
          role="status"
          aria-live="polite"
          className="border-destructive/30 bg-destructive/10 text-destructive flex flex-col justify-between gap-3 rounded-lg border p-4 sm:flex-row sm:items-center"
        >
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="text-xl">
              ⚠️
            </span>
            <div>
              <p className="text-sm font-semibold">Review Required for SLA Breaches</p>
              <p className="text-xs opacity-90">
                Members exceeding SLA: {summary.reviewRequiredMemberIds.join(", ")}
              </p>
            </div>
          </div>
          {onFilterReviewRequired && (
            <button
              type="button"
              onClick={onFilterReviewRequired}
              aria-pressed={reviewRequiredFilterActive}
              aria-label={
                reviewRequiredFilterActive
                  ? "Clear review required filter"
                  : "Filter table to review required members only"
              }
              className={`focus-visible:ring-destructive shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${
                reviewRequiredFilterActive
                  ? "border-destructive bg-destructive text-destructive-foreground"
                  : "border-destructive/40 bg-background hover:bg-muted text-foreground"
              }`}
            >
              {reviewRequiredFilterActive ? "Showing Review Required" : "Filter Review Required"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
