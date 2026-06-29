import type { ReactNode } from "react";

interface ErrorStateProps {
  action?: ReactNode;
  className?: string;
  details?: string;
  icon?: ReactNode;
  title: string;
}

/**
 * ErrorState — shown when payout request loading or submission fails.
 *
 * Accessibility:
 * - role="alert" triggers immediate screen reader announcement
 * - icon is aria-hidden (decorative)
 */
export function ErrorState({ action, className, details, icon, title }: ErrorStateProps) {
  return (
    <div
      role="alert"
      aria-label="Payout request error"
      className={`mx-auto flex max-w-md flex-col items-center justify-center text-center py-12 px-4 ${className ?? ""}`}
    >
      {icon ? (
        <div
          className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive"
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
