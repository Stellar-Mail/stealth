interface DraftImproverLoadingStateProps {
  message?: string;
  rowCount?: number;
}

export function DraftImproverLoadingState({
  message = "Analyzing draft for improvements...",
  rowCount = 3,
}: DraftImproverLoadingStateProps) {
  return (
    <section aria-busy="true" aria-live="polite" className="space-y-4" role="status">
      <span className="sr-only">{message}</span>
      {Array.from({ length: rowCount }).map((_, index) => (
        <div
          aria-hidden="true"
          className="rounded-lg border border-border bg-card p-4 shadow-sm"
          key={index}
        >
          <div className="flex items-start gap-4">
            <div className="size-10 animate-pulse rounded-md bg-muted" />
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex gap-2">
                <div className="h-5 w-16 animate-pulse rounded bg-muted" />
                <div className="h-5 w-20 animate-pulse rounded bg-muted" />
              </div>
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}

export type { DraftImproverLoadingStateProps };
