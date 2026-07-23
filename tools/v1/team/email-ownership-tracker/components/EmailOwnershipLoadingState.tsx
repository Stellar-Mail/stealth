interface EmailOwnershipLoadingStateProps {
  message?: string;
  rowCount?: number;
}

export function EmailOwnershipLoadingState({
  message = "Loading ownership history...",
  rowCount = 3,
}: EmailOwnershipLoadingStateProps) {
  return (
    <section role="status" aria-busy="true" aria-live="polite" className="space-y-4">
      <span className="sr-only">{message}</span>

      {Array.from({ length: rowCount }).map((_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="rounded-lg border border-slate-200 bg-white p-4"
        >
          <div className="space-y-3">
            <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </section>
  );
}

export type { EmailOwnershipLoadingStateProps };
