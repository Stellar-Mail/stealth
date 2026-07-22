import type { ReactNode } from "react";

/**
 * SuccessState Component
 *
 * Accessible success state confirming payment approval action.
 *
 * Accessibility features:
 * - role="status" with aria-live="assertive" for immediate announcement
 * - Clear confirmation message for screen readers
 * - Success details for transparency
 * - Next action button clearly labeled
 */
interface SuccessStateProps {
  action?: ReactNode;
  className?: string;
  details?: string;
  icon?: ReactNode;
  title: string;
}

export function SuccessState({ action, className, details, icon, title }: SuccessStateProps) {
  return (
    <div
      role="status"
      aria-live="assertive"
      aria-label="Payment approval successful"
      className={`mx-auto flex max-w-md flex-col items-center justify-center text-center py-12 px-4 ${
        className || ""
      }`}
    >
      {icon ? (
        <div
          className="glass-tile mb-6 flex size-14 items-center justify-center rounded-2xl text-emerald-500"
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
