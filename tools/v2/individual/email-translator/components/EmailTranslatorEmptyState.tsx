import { Languages } from "lucide-react";
import type { ReactNode } from "react";

interface EmailTranslatorEmptyStateProps {
  action?: ReactNode;
  description?: string;
  title?: string;
}

/**
 * Empty state displayed when no translation has been performed.
 */
export function EmailTranslatorEmptyState({
  action,
  description = "Enter or paste email text to translate between languages.",
  title = "No text to translate",
}: EmailTranslatorEmptyStateProps) {
  return (
    <section
      aria-label="No translation results"
      className="mx-auto flex max-w-lg flex-col items-center justify-center px-4 py-12 text-center"
      role="status"
    >
      <div
        aria-hidden="true"
        className="mb-5 flex size-14 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700"
      >
        <Languages className="size-7" />
      </div>
      <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </section>
  );
}

export type { EmailTranslatorEmptyStateProps };
