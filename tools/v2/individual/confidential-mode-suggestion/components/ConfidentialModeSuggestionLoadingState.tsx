interface ConfidentialModeSuggestionLoadingStateProps {
  message?: string;
  rowCount?: number;
}

export function ConfidentialModeSuggestionLoadingState({
  message = "Analyzing confidential mode recommendations...",
  rowCount = 3,
}: ConfidentialModeSuggestionLoadingStateProps) {
  return (
    <section role="status" aria-live="polite" aria-busy="true" className="space-y-4">
      <span className="sr-only">{message}</span>

      {Array.from({ length: rowCount }).map((_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="rounded-lg border border-border bg-card p-4 shadow-sm"
        >
          <div className="flex items-start gap-4">
            <div className="size-10 animate-pulse rounded-md bg-muted" />

            <div className="min-w-0 flex-1 space-y-3">
              <div className="h-5 w-40 animate-pulse rounded bg-muted" />
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}

export type { ConfidentialModeSuggestionLoadingStateProps };
