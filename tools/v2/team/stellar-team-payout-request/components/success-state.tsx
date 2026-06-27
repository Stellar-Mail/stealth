/**
 * SuccessState - Confirms a payout request was created.
 */
import type { ReactNode } from "react";

interface SuccessStateProps {
  action?: ReactNode;
  className?: string;
  details?: string;
  title: string;
}

export function SuccessState({ action, className, details, title }: SuccessStateProps) {
  return (
    <div
      role="status"
      aria-live="assertive"
      aria-label="Payout request submitted"
      className={`mx-auto flex max-w-md flex-col items-center justify-center text-center py-12 px-4 ${className ?? ""}`}
    >
      <div
        className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500 dark:bg-emerald-950"
        aria-hidden="true"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-7 w-7"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
      {details ? <p className="mt-3 text-sm leading-6 text-muted-foreground">{details}</p> : null}
      {action ? <div className="mt-7">{action}</div> : null}
    </div>
  );
}

export type { SuccessStateProps };
