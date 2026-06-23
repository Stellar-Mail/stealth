import { Inbox, UserPlus } from "lucide-react";
import type { ReactNode } from "react";

interface OwnershipEmptyStateProps {
  action?: ReactNode;
  description?: string;
  title?: string;
}

export function OwnershipEmptyState({
  action,
  description = "Add a shared inbox sample to preview ownership tracking.",
  title = "No ownership records",
}: OwnershipEmptyStateProps) {
  return (
    <section
      aria-label="No ownership records"
      className="mx-auto flex max-w-lg flex-col items-center justify-center px-4 py-12 text-center"
      role="status"
    >
      <div
        aria-hidden="true"
        className="mb-5 flex size-14 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-800"
      >
        <Inbox className="size-7" />
      </div>
      <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
      {action ? (
        <div className="mt-6">{action}</div>
      ) : (
        <div className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500">
          <UserPlus aria-hidden="true" className="size-4" />
          Awaiting shared inbox data
        </div>
      )}
    </section>
  );
}

export type { OwnershipEmptyStateProps };
