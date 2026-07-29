import React from "react";

export interface LoadingStateProps {
  message?: string;
}

/**
 * Accessible Loading State component for Team Analytics Dashboard.
 *
 * Uses `role="status"`, `aria-live="polite"`, and `aria-busy="true"` so assistive technologies
 * announce when data is being fetched without interrupting current user speech.
 */
export function LoadingState({ message = "Loading team analytics dashboard…" }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="border-border bg-card text-card-foreground flex flex-col items-center justify-center gap-4 rounded-lg border p-12 text-center"
    >
      <div className="text-primary h-8 w-8 animate-spin" aria-hidden="true">
        <svg
          className="h-full w-full"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>
      <p className="text-muted-foreground text-sm font-medium">{message}</p>
    </div>
  );
}
