import React from "react";

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

/**
 * Accessible Error State component for Team Analytics Dashboard.
 *
 * Uses `role="alert"` and `aria-live="assertive"` for immediate screen-reader announcement.
 * Includes a keyboard-accessible retry action button.
 */
export function ErrorState({
  title = "Unable to load team analytics",
  message,
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="border-destructive/30 bg-destructive/10 text-destructive flex flex-col items-center justify-center gap-4 rounded-lg border p-8 text-center"
    >
      <div
        aria-hidden="true"
        className="bg-destructive/15 flex h-10 w-10 items-center justify-center rounded-full text-xl"
      >
        ⚠️
      </div>
      <div className="max-w-md space-y-1">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-sm opacity-90">{message}</p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          aria-label="Retry loading analytics data"
          className="border-destructive/40 bg-background text-foreground hover:bg-muted focus-visible:ring-destructive inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Try again
        </button>
      )}
    </div>
  );
}
