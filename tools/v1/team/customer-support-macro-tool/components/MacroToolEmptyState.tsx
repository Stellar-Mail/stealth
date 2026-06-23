import { FileText, Plus } from "lucide-react";
import type { ReactNode } from "react";

interface MacroToolEmptyStateProps {
  action?: ReactNode;
  description?: string;
  title?: string;
}

export function MacroToolEmptyState({
  action,
  description = "Create or import support macros to preview the team response workflow.",
  title = "No support macros",
}: MacroToolEmptyStateProps) {
  return (
    <section
      aria-label="No support macros"
      className="mx-auto flex max-w-lg flex-col items-center justify-center px-4 py-12 text-center"
      role="status"
    >
      <div
        aria-hidden="true"
        className="mb-5 flex size-14 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-800"
      >
        <FileText className="size-7" />
      </div>
      <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
      {action ? (
        <div className="mt-6">{action}</div>
      ) : (
        <div className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500">
          <Plus aria-hidden="true" className="size-4" />
          Awaiting macro data
        </div>
      )}
    </section>
  );
}

export type { MacroToolEmptyStateProps };
