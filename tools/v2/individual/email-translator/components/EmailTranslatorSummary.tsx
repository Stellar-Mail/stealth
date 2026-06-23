import type { EmailTranslatorSummary as Summary } from "../types";

interface EmailTranslatorSummaryProps {
  summary: Summary;
}

const summaryItems = [
  ["translated", "Translated"],
  ["needsReview", "Review"],
  ["blocked", "Blocked"],
  ["totalTranslations", "Total"],
] as const;

export function EmailTranslatorSummary({ summary }: EmailTranslatorSummaryProps) {
  return (
    <dl aria-label="Email translation summary" className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {summaryItems.map(([key, label]) => (
        <div className="rounded-lg border border-slate-200 bg-white p-4" key={key}>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
          <dd className="mt-1 text-2xl font-semibold text-slate-950">{summary[key]}</dd>
        </div>
      ))}
    </dl>
  );
}

export type { EmailTranslatorSummaryProps };
