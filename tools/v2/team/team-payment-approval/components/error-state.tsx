import type { ReactNode } from "react";

/**
 * ErrorState Component
 *
 * Accessible error state for payment approval failures.
 *
 * Accessibility features:
 * - role="alert" announces errors immediately to screen readers
 * - aria-label provides context
 * - Error details in structured format for clarity
 * - Action button for recovery/retry
 */
interface ErrorStateProps {
  action?: ReactNode;
  className?: string;
  details?: string;
  icon?: ReactNode;
  title: string;
}

export function ErrorState({ action, className, details, icon, title }: ErrorStateProps) {
  return (
    <div
      role="alert"
      aria-label="Error loading payment approvals"
      className={`mx-auto flex max-w-md flex-col items-center justify-center text-center py-12 px-4 ${
        className || ""
      }`}
    >
      {icon ? (
        <div
          className="glass-tile mb-6 flex size-14 items-center justify-center rounded-2xl text-destructive"
          aria-hidden="true"
        >
          {icon}
        </div>
      ) : null}
      <h2 className="text-2xl font-semibold text-destructive">{title}</h2>
      {details ? <p className="mt-3 text-sm leading-6 text-muted-foreground">{details}</p> : null}
      {action ? <div className="mt-7">{action}</div> : null}
    </div>
  );
}

export type { ErrorStateProps };
