/**
 * LoadingState - Accessible loading skeleton for payout list/form.
 */
interface LoadingStateProps {
  message?: string;
  itemCount?: number;
}

export function LoadingState({
  message = "Loading payout requests...",
  itemCount = 3,
}: LoadingStateProps) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="space-y-4 w-full">
      <div className="sr-only">{message}</div>
      {Array.from({ length: itemCount }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 animate-pulse"
          aria-hidden="true"
        >
          <div className="h-10 w-10 rounded-full bg-muted-foreground/20" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-40 rounded bg-muted-foreground/20" />
            <div className="h-3 w-24 rounded bg-muted-foreground/20" />
          </div>
          <div className="h-6 w-16 rounded bg-muted-foreground/20" />
        </div>
      ))}
    </div>
  );
}

export type { LoadingStateProps };
