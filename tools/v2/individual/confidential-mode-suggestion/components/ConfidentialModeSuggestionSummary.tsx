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
      className="rounded-lg border border-border bg-card p-4"
    >
      <h2 id="confidential-summary-title" className="text-lg font-semibold text-foreground">
        Privacy Summary
      </h2>

      <dl className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-md border border-border bg-muted p-3">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Privacy Score</dt>
          <dd className="mt-1 text-2xl font-bold text-foreground">{score}</dd>
        </div>

        <div className="rounded-md border border-border bg-muted p-3">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Recommendations</dt>
          <dd className="mt-1 text-2xl font-bold text-foreground">{recommendationCount}</dd>
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
