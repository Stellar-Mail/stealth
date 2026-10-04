import React from "react";
import type { AssignmentSummary } from "../types";

interface AssignmentSummaryCardProps {
  summary: AssignmentSummary;
}

export const AssignmentSummaryCard: React.FC<AssignmentSummaryCardProps> = ({ summary }) => {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Assignment summary">
      <div className="rounded-md bg-muted p-3">
        <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total</dt>
        <dd className="mt-1 text-lg font-semibold text-foreground">{summary.total}</dd>
      </div>
      <div className="rounded-md bg-muted p-3">
        <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Assigned
        </dt>
        <dd className="mt-1 text-lg font-semibold text-green-700">{summary.assigned}</dd>
      </div>
      <div className="rounded-md bg-muted p-3">
        <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Unassigned
        </dt>
        <dd className="mt-1 text-lg font-semibold text-amber-700">{summary.unassigned}</dd>
      </div>
      <div className="rounded-md bg-muted p-3">
        <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Coverage
        </dt>
        <dd className="mt-1 text-lg font-semibold text-foreground">{summary.coveragePercent}%</dd>
      </div>
    </dl>
  );
};
