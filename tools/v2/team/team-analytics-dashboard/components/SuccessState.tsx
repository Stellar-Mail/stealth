import React from "react";

export interface SuccessStateProps {
  title?: string;
  message: string;
  onDismiss?: () => void;
}

/**
 * Accessible Success State banner for Team Analytics Dashboard.
 *
 * Uses `role="status"` and `aria-live="polite"` to confirm actions without interrupting speech.
 */
export function SuccessState({ title = "Success", message, onDismiss }: SuccessStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300 flex items-start justify-between gap-4 rounded-lg border p-4"
    >
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="text-lg">
          ✓
        </span>
        <div className="space-y-0.5">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs opacity-90">{message}</p>
        </div>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="text-green-700 hover:bg-green-500/20 dark:text-green-300 focus-visible:ring-green-500 rounded-md p-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}
