import * as React from "react";
import { A11Y } from "../types";

/**
 * ErrorState — recoverable error display with a retry button.
 * Uses role="alert" so the error message is announced immediately to
 * screen readers, and provides a keyboard-accessible retry affordance.
 */
export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-5 px-6 py-16 text-center"
      id="binder-error-state"
    >
      {/* Error icon */}
      <div
        className="flex h-14 w-14 items-center justify-center rounded-full"
        style={{
          backgroundColor: "oklch(0.62 0.2 25 / 0.12)",
          border: "1px solid oklch(0.62 0.2 25 / 0.25)",
        }}
        aria-hidden="true"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="var(--destructive)" strokeWidth="1.5" />
          <path d="M12 8v5" stroke="var(--destructive)" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="12" cy="16" r="1" fill="var(--destructive)" />
        </svg>
      </div>

      {/* Error message — role="alert" for immediate screen reader announcement */}
      <div className="flex flex-col gap-1.5" role="alert">
        <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
          {A11Y.errorHeading}
        </h2>
        <p className="max-w-sm text-sm" style={{ color: "var(--muted-foreground)" }}>
          {message}
        </p>
      </div>

      {/* Retry button */}
      <button
        type="button"
        onClick={onRetry}
        aria-label={A11Y.retryLabel}
        className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "var(--card)",
          color: "var(--foreground)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "var(--accent)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "var(--card)";
        }}
        onFocus={(e) => {
          e.currentTarget.style.boxShadow = `0 0 0 2px var(--ring)`;
        }}
        onBlur={(e) => {
          e.currentTarget.style.boxShadow = "none";
        }}
        id="binder-retry-button"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M2.5 8a5.5 5.5 0 0 1 9.37-3.9M13.5 8a5.5 5.5 0 0 1-9.37 3.9"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M12 1.5v3h-3M4 11.5v3h3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Retry
      </button>
    </div>
  );
}
