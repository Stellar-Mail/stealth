import type { ReactNode } from "react";

interface EmptyStateProps {
  action?: ReactNode;
  className?: string;
  description: ReactNode;
  icon?: ReactNode;
  title: ReactNode;
}

/**
 * EmptyState — shown when no payout requests exist.
 *
 * Accessibility:
 * - role="status" informs screen readers of the empty state
 * - icon is aria-hidden (decorative)
 */
export function EmptyState({ action, className, description, icon, title }: EmptyStateProps) {
  return (
    <div
      role="status"
      aria-label="No payout requests"
      className={`mx-auto flex max-w-md flex-col items-center justify-center text-center py-12 px-4 ${className ?? ""}`}
    >
      {icon ? (
        <div
          className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-muted text-foreground"
          aria-hidden="true"
        >
          {icon}
        </div>
      ) : null}
      <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
      {action ? <div className="mt-7">{action}</div> : null}
    </div>
  );
}

export type { EmptyStateProps };
