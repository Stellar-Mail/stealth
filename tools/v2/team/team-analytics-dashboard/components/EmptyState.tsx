import React from "react";

export interface EmptyStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Accessible Empty State component for Team Analytics Dashboard.
 *
 * Uses `role="status"` so screen readers politely announce when a view is empty.
 * Interactive action button has keyboard focus styling and an explicit aria-label.
 */
export function EmptyState({
  title = "No analytics data available",
  description = "Load a team analytics period or select a different reporting range to view performance metrics.",
  actionLabel = "Load sample data",
  onAction,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      aria-labelledby="analytics-empty-state-title"
      className="border-border bg-card text-card-foreground flex flex-col items-center justify-center gap-4 rounded-lg border p-8 text-center"
    >
      <div
        aria-hidden="true"
        className="bg-muted flex h-12 w-12 items-center justify-center rounded-full text-2xl"
      >
        📊
      </div>
      <div className="max-w-sm space-y-1">
        <h2 id="analytics-empty-state-title" className="text-foreground text-lg font-semibold">
          {title}
        </h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      {onAction && (
        <button
          type="button"
          onClick={onAction}
          aria-label={actionLabel}
          className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
