import { AlertTriangle, RotateCcw } from "lucide-react";

interface EmailOwnershipErrorStateProps {
  title?: string;
  details?: string;
  onRetry?: () => void;
}

export function EmailOwnershipErrorState({
  title = "Unable to load ownership history",
  details = "An error occurred while processing ownership records.",
  onRetry,
}: EmailOwnershipErrorStateProps) {
  return (
    <section
      role="alert"
      aria-label="Ownership tracker error"
      className="mx-auto flex max-w-lg flex-col items-center justify-center px-4 py-12 text-center"
    >
      <div
        aria-hidden="true"
        className="mb-5 flex size-14 items-center justify-center rounded-lg border border-red-200 bg-red-50"
      >
        <AlertTriangle className="size-7 text-red-700" />
      </div>

      <h2 className="text-xl font-semibold text-red-900">{title}</h2>

      <p className="mt-3 text-sm leading-6 text-slate-700">{details}</p>

      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          Retry
        </button>
      ) : null}
    </section>
  );
}

export type { EmailOwnershipErrorStateProps };
