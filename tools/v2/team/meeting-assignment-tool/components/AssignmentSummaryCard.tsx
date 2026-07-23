import React from "react";
import type { AssignmentSummary } from "../types";

interface AssignmentSummaryCardProps {
  summary: AssignmentSummary;
}

export const AssignmentSummaryCard: React.FC<AssignmentSummaryCardProps> = ({ summary }) => {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Assignment summary">
      <div className="rounded-md bg-gray-50 p-3">
        <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Total</dt>
        <dd className="mt-1 text-lg font-semibold text-gray-900">{summary.total}</dd>
      </div>
      <div className="rounded-md bg-gray-50 p-3">
        <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Assigned</dt>
        <dd className="mt-1 text-lg font-semibold text-green-700">{summary.assigned}</dd>
      </div>
      <div className="rounded-md bg-gray-50 p-3">
        <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Unassigned</dt>
        <dd className="mt-1 text-lg font-semibold text-amber-700">{summary.unassigned}</dd>
      </div>
      <div className="rounded-md bg-gray-50 p-3">
        <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Coverage</dt>
        <dd className="mt-1 text-lg font-semibold text-gray-900">{summary.coveragePercent}%</dd>
      </div>
    </dl>
  );
};
