interface ConfidentialModeSuggestionSummaryProps {
  score: number;
  recommendationCount: number;
  highSeverityCount: number;
}

export function ConfidentialModeSuggestionSummary({
  score,
  recommendationCount,
  highSeverityCount,
}: ConfidentialModeSuggestionSummaryProps) {
  return (
    <section
      aria-labelledby="confidential-summary-title"
      className="rounded-lg border border-slate-200 bg-white p-4"
    >
      <h2 id="confidential-summary-title" className="text-lg font-semibold text-slate-900">
        Privacy Summary
      </h2>

      <dl className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <dt className="text-xs uppercase tracking-wide text-slate-500">Privacy Score</dt>
          <dd className="mt-1 text-2xl font-bold text-slate-900">{score}</dd>
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <dt className="text-xs uppercase tracking-wide text-slate-500">Recommendations</dt>
          <dd className="mt-1 text-2xl font-bold text-slate-900">{recommendationCount}</dd>
        </div>

        <div className="rounded-md border border-red-200 bg-red-50 p-3">
          <dt className="text-xs uppercase tracking-wide text-red-700">High Priority</dt>
          <dd className="mt-1 text-2xl font-bold text-red-800">{highSeverityCount}</dd>
        </div>
      </dl>
    </section>
  );
}

export type { ConfidentialModeSuggestionSummaryProps };
