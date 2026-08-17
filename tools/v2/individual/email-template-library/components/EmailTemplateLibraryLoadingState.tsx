interface EmailTemplateLibraryLoadingStateProps {
  message?: string;
  rowCount?: number;
}

export function EmailTemplateLibraryLoadingState({
  message = "Loading templates...",
  rowCount = 3,
}: EmailTemplateLibraryLoadingStateProps) {
  return (
    <section aria-busy="true" aria-live="polite" className="space-y-4" role="status">
      <span className="sr-only">{message}</span>
      {Array.from({ length: rowCount }).map((_, index) => (
        <div
          aria-hidden="true"
          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          key={index}
        >
          <div className="flex items-start gap-4">
            <div className="size-10 animate-pulse rounded-md bg-slate-200" />
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex gap-2">
                <div className="h-5 w-32 animate-pulse rounded bg-slate-200" />
                <div className="h-5 w-20 animate-pulse rounded bg-slate-200" />
              </div>
              <div className="h-4 w-full animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}

export type { EmailTemplateLibraryLoadingStateProps };
