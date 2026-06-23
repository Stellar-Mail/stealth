import type { ConfidentialModeSummary as Summary } from "../types";

interface ConfidentialModeSummaryProps {
  summary: Summary;
}

const summaryItems = [
  ["suggested", "Suggested"],
  ["blocked", "Blocked"],
  ["safe", "Safe"],
  ["totalSuggestions", "Total"],
] as const;

export function ConfidentialModeSummary({ summary }: ConfidentialModeSummaryProps) {
  return (
    <dl
      aria-label="Confidential-mode suggestion summary"
      className="grid grid-cols-2 gap-3 md:grid-cols-4"
    >
      {summaryItems.map(([key, label]) => (
        <div className="rounded-lg border border-slate-200 bg-white p-4" key={key}>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
          <dd className="mt-1 text-2xl font-semibold text-slate-950">{summary[key]}</dd>
        </div>
      ))}
    </dl>
  );
}

export type { ConfidentialModeSummaryProps };
