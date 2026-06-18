import type { ReactNode } from "react";

interface SuccessStateProps {
  action?: ReactNode;
  className?: string;
  details?: string;
  icon?: ReactNode;
  title: string;
}

/**
 * SuccessState — confirms a payout request was submitted successfully.
 *
 * Accessibility:
 * - role="status" + aria-live="assertive" announces immediately
 * - icon is aria-hidden (decorative)
 */
export function SuccessState({ action, className, details, icon, title }: SuccessStateProps) {
  return (
    <div
      role="status"
      aria-live="assertive"
      aria-label="Payout request submitted"
      className={`mx-auto flex max-w-md flex-col items-center justify-center text-center py-12 px-4 ${className ?? ""}`}
    >
      {icon ? (
        <div
          className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500"
          aria-hidden="true"
        >
          {icon}
        </div>
      ) : null}
      <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
      {details ? <p className="mt-3 text-sm leading-6 text-muted-foreground">{details}</p> : null}
      {action ? <div className="mt-7">{action}</div> : null}
    </div>
  );
}

export type { SuccessStateProps };
