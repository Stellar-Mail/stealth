import React from "react";
import type { AnalyticsSnapshot, SnapshotStatus } from "../contract/analytics-contract";

export interface SnapshotListProps {
  snapshots: AnalyticsSnapshot[];
  selectedSnapshotId?: string | null;
  onSelectSnapshot?: (snapshotId: string) => void;
  "aria-label"?: string;
}

function getSnapshotStatusBadge(status: SnapshotStatus) {
  switch (status) {
    case "healthy":
      return (
        <span
          className="bg-green-500/15 text-green-600 dark:text-green-400 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
          aria-label="Status: Healthy"
        >
          <span aria-hidden="true">✓</span> Healthy
        </span>
      );
    case "watch":
      return (
        <span
          className="bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
          aria-label="Status: Watch"
        >
          <span aria-hidden="true">👀</span> Watch
        </span>
      );
    case "needs-attention":
      return (
        <span
          className="bg-orange-500/15 text-orange-600 dark:text-orange-400 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
          aria-label="Status: Needs Attention"
        >
          <span aria-hidden="true">⚠️</span> Needs Attention
        </span>
      );
    case "blocked":
    default:
      return (
        <span
          className="bg-destructive/15 text-destructive inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
          aria-label="Status: Blocked"
        >
          <span aria-hidden="true">🛑</span> Blocked
        </span>
      );
  }
}

/**
 * Accessible Snapshot List component for Team Analytics Dashboard.
 *
 * Renders team analytics snapshots as keyboard-navigable cards with status indicators
 * combining icon and text, and clear review-required alerts.
 */
export function SnapshotList({
  snapshots,
  selectedSnapshotId,
  onSelectSnapshot,
  "aria-label": ariaLabel = "Team analytics snapshots",
}: SnapshotListProps) {
  if (snapshots.length === 0) {
    return (
      <div
        role="status"
        className="border-border bg-card text-muted-foreground rounded-lg border p-8 text-center text-sm"
      >
        No team analytics snapshots found for this view.
      </div>
    );
  }

  return (
    <ul role="list" aria-label={ariaLabel} className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {snapshots.map((snapshot) => {
        const isSelected = selectedSnapshotId === snapshot.id;
        const avgResponseDisplay =
          snapshot.averageFirstResponseHours === null
            ? "N/A"
            : `${snapshot.averageFirstResponseHours}h`;

        const cardLabel = `Snapshot for team ${snapshot.team}, status ${snapshot.status}, period ${
          snapshot.period
        }${snapshot.reviewRequired ? ", review required" : ""}`;

        return (
          <li role="listitem" key={snapshot.id}>
            <div
              role={onSelectSnapshot ? "button" : undefined}
              tabIndex={onSelectSnapshot ? 0 : undefined}
              aria-label={cardLabel}
              aria-pressed={onSelectSnapshot ? isSelected : undefined}
              onClick={() => onSelectSnapshot?.(snapshot.id)}
              onKeyDown={(e) => {
                if (onSelectSnapshot && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  onSelectSnapshot(snapshot.id);
                }
              }}
              className={`border-border bg-card text-card-foreground flex flex-col justify-between rounded-lg border p-4 shadow-sm transition-colors ${
                isSelected ? "border-primary bg-primary/10" : "hover:bg-muted/30"
              } ${
                onSelectSnapshot
                  ? "cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  : ""
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold">{snapshot.team}</h3>
                    <p className="text-muted-foreground text-xs">Period: {snapshot.period}</p>
                  </div>
                  <div>{getSnapshotStatusBadge(snapshot.status)}</div>
                </div>

                <dl className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-muted/50 rounded p-2">
                    <dt className="text-muted-foreground font-medium">Threads</dt>
                    <dd className="mt-0.5 text-sm font-semibold">{snapshot.totalThreads}</dd>
                  </div>

                  <div className="bg-muted/50 rounded p-2">
                    <dt className="text-muted-foreground font-medium">Backlog</dt>
                    <dd className="mt-0.5 text-sm font-semibold">{snapshot.openBacklog}</dd>
                  </div>

                  <div className="bg-muted/50 rounded p-2">
                    <dt className="text-muted-foreground font-medium">Avg Response</dt>
                    <dd
                      className="mt-0.5 text-sm font-semibold"
                      aria-label={
                        snapshot.averageFirstResponseHours === null
                          ? "Not applicable"
                          : `${snapshot.averageFirstResponseHours} hours`
                      }
                    >
                      {avgResponseDisplay}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs">
                <span className="text-muted-foreground">
                  Source: <code className="font-mono">{snapshot.sourceReportId}</code>
                </span>

                {snapshot.reviewRequired && (
                  <span
                    role="status"
                    aria-label="Review Required for this team"
                    className="bg-destructive/15 text-destructive inline-flex items-center gap-1 rounded px-2 py-0.5 font-semibold"
                  >
                    <span aria-hidden="true">⚠️</span> Review Required
                  </span>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
