import type { SharedInboxSummary as SharedInboxSummaryModel } from "../types";

interface SharedInboxSummaryProps {
  summary: SharedInboxSummaryModel;
}

const summaryItems = [
  ["total", "Total"],
  ["unassigned", "Unassigned"],
  ["claimed", "Claimed"],
  ["inProgress", "In progress"],
  ["awaitingReply", "Awaiting reply"],
  ["resolved", "Resolved"],
] as const;

export function SharedInboxSummary({ summary }: SharedInboxSummaryProps) {
  return (
    <dl
      className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6"
      aria-label="Shared inbox message summary"
    >
      {summaryItems.map(([key, label]) => (
        <div key={key} className="rounded-lg border border-slate-200 bg-white p-4">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
          <dd className="mt-2 text-2xl font-semibold text-slate-950">{summary[key]}</dd>
        </div>
      ))}
    </dl>
  );
}
