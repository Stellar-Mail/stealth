interface DraftImproverSummaryProps {
  totalIssues: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
}

export function DraftImproverSummary({
  totalIssues,
  errorCount,
  warningCount,
  infoCount,
}: DraftImproverSummaryProps) {
  const summaryItems = [
    ["totalIssues", "Total Issues", totalIssues],
    ["errors", "Errors", errorCount],
    ["warnings", "Warnings", warningCount],
    ["infoItems", "Info", infoCount],
  ] as const;

  return (
    <dl aria-label="Issue summary" className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {summaryItems.map(([key, label, value]) => (
        <div
          className={`rounded-lg border p-4 ${
            key === "errors" && value > 0 ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"
          }`}
          key={key}
        >
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
          <dd
            className={`mt-1 text-2xl font-semibold ${
              key === "errors" && value > 0 ? "text-red-800" : "text-slate-950"
            }`}
          >
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export type { DraftImproverSummaryProps };
