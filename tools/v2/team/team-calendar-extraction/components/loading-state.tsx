/**
 * LoadingState Component
 *
 * Accessible loading state for calendar extraction operations.
 *
 * Accessibility features:
 * - role="status" with aria-live="polite" for dynamic updates
 * - aria-busy="true" indicates loading in progress
 * - Skeleton elements with aria-hidden for visual effect
 * - Screen reader will announce the loading message
 */
interface LoadingStateProps {
  message?: string;
  itemCount?: number;
}

export function LoadingState({
  message = "Extracting calendar events...",
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
          <div className="size-10 rounded-full bg-muted-foreground/20" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-48 rounded bg-muted-foreground/20" />
            <div className="h-3 w-32 rounded bg-muted-foreground/20" />
          </div>
          <div className="h-9 w-24 rounded bg-muted-foreground/20" />
        </div>
      ))}
    </div>
  );
}

export type { LoadingStateProps };
