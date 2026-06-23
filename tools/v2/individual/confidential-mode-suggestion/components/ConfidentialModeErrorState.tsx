import { AlertTriangle, RotateCcw } from "lucide-react";

interface ConfidentialModeErrorStateProps {
  details?: string;
  onRetry?: () => void;
  title?: string;
}

export function ConfidentialModeErrorState({
  details = "Confidential-mode suggestions could not be prepared. Retry with the same local draft or review manually.",
  onRetry,
  title = "Privacy review failed",
}: ConfidentialModeErrorStateProps) {
  return (
    <section
      aria-label="Confidential-mode suggestion error"
      className="mx-auto flex max-w-lg flex-col items-center justify-center px-4 py-12 text-center"
      role="alert"
    >
      <div
        aria-hidden="true"
        className="mb-5 flex size-14 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700"
      >
        <AlertTriangle className="size-7" />
      </div>
      <h2 className="text-xl font-semibold text-red-900">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-700">{details}</p>
      {onRetry ? (
        <button
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
          onClick={onRetry}
          type="button"
        >
          <RotateCcw aria-hidden="true" className="size-4" />
          Retry
        </button>
      ) : null}
    </section>
  );
}

export type { ConfidentialModeErrorStateProps };
