import type { ReactNode } from "react";

interface EmptyStateProps {
  action?: ReactNode;
  className?: string;
  description: ReactNode;
  icon?: ReactNode;
  title: ReactNode;
}

/**
 * EmptyState Component
 *
 * Accessible empty state for when no payment requests exist.
 *
 * Accessibility features:
 * - Semantic heading hierarchy with role="status" when used as state change
 * - Clear descriptive text for screen readers
 * - Action button receives focus for keyboard navigation
 */
export function EmptyState({ action, className, description, icon, title }: EmptyStateProps) {
  return (
    <div
      className={`mx-auto flex max-w-md flex-col items-center justify-center text-center py-12 px-4 ${
        className || ""
      }`}
      role="status"
      aria-label="No payment requests"
    >
      {icon ? (
        <div
          className="glass-tile mb-6 flex size-14 items-center justify-center rounded-2xl text-foreground"
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
