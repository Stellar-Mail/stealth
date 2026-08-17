import { Shield } from "lucide-react";
import type { ReactNode } from "react";

interface ConfidentialModeSuggestionEmptyStateProps {
  action?: ReactNode;
  title?: string;
  description?: string;
}

export function ConfidentialModeSuggestionEmptyState({
  action,
  title = "No draft available",
  description = "Add or paste an email draft to receive confidential mode recommendations.",
}: ConfidentialModeSuggestionEmptyStateProps) {
  return (
    <section
      role="status"
      aria-label="No confidential mode suggestions"
      className="mx-auto flex max-w-lg flex-col items-center justify-center px-4 py-12 text-center"
    >
      <div
        aria-hidden="true"
        className="mb-5 flex size-14 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700"
      >
        <Shield className="size-7" />
      </div>

      <h2 className="text-xl font-semibold text-slate-950">{title}</h2>

      <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>

      {action ? <div className="mt-6">{action}</div> : null}
    </section>
  );
}

export type { ConfidentialModeSuggestionEmptyStateProps };
