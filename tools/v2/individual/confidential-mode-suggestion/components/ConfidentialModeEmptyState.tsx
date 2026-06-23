import { MailPlus, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

interface ConfidentialModeEmptyStateProps {
  action?: ReactNode;
  description?: string;
  title?: string;
}

export function ConfidentialModeEmptyState({
  action,
  description = "Add a draft sample to preview confidential-mode recommendations.",
  title = "No privacy suggestions yet",
}: ConfidentialModeEmptyStateProps) {
  return (
    <section
      aria-label="No confidential-mode suggestions"
      className="mx-auto flex max-w-lg flex-col items-center justify-center px-4 py-12 text-center"
      role="status"
    >
      <div
        aria-hidden="true"
        className="mb-5 flex size-14 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800"
      >
        <ShieldCheck className="size-7" />
      </div>
      <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
      {action ? (
        <div className="mt-6">{action}</div>
      ) : (
        <div className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500">
          <MailPlus aria-hidden="true" className="size-4" />
          Awaiting draft input
        </div>
      )}
    </section>
  );
}

export type { ConfidentialModeEmptyStateProps };
