import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

interface EmailOwnershipEmptyStateProps {
  action?: ReactNode;
  title?: string;
  description?: string;
}

export function EmailOwnershipEmptyState({
  action,
  title = "No ownership history",
  description = "Load ownership events to review thread ownership history.",
}: EmailOwnershipEmptyStateProps) {
  return (
    <section
      role="status"
      aria-label="No ownership records"
      className="mx-auto flex max-w-lg flex-col items-center justify-center px-4 py-12 text-center"
    >
      <div
        aria-hidden="true"
        className="mb-5 flex size-14 items-center justify-center rounded-lg border border-slate-200 bg-slate-50"
      >
        <Inbox className="size-7 text-slate-700" />
      </div>

      <h2 className="text-xl font-semibold text-slate-950">{title}</h2>

      <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>

      {action ? <div className="mt-6">{action}</div> : null}
    </section>
  );
}

export type { EmailOwnershipEmptyStateProps };
