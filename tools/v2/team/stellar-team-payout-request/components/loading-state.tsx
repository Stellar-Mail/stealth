/**
 * LoadingState — skeleton shown while payout requests are fetching.
 *
 * Accessibility:
 * - role="status" + aria-busy="true" signals in-progress fetch
 * - sr-only message read by screen readers; skeletons are aria-hidden
 */
interface LoadingStateProps {
  message?: string;
  itemCount?: number;
}

export function LoadingState({
  message = "Loading payout requests…",
  itemCount = 3,
}: LoadingStateProps) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="w-full space-y-4">
      <span className="sr-only">{message}</span>
      {Array.from({ length: itemCount }).map((_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="flex animate-pulse items-center gap-4 rounded-lg bg-muted/50 p-4"
        >
          <div className="size-12 rounded bg-muted-foreground/20" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 rounded bg-muted-foreground/20" />
            <div className="h-3 w-24 rounded bg-muted-foreground/20" />
          </div>
          <div className="h-9 w-20 rounded bg-muted-foreground/20" />
        </div>
      ))}
    </div>
  );
}

export type { LoadingStateProps };
