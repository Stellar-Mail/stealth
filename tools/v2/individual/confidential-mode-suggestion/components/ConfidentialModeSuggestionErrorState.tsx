import { AlertTriangle, RotateCcw } from "lucide-react";

interface ConfidentialModeSuggestionErrorStateProps {
  title?: string;
  details?: string;
  onRetry?: () => void;
}

export function ConfidentialModeSuggestionErrorState({
  title = "Analysis failed",
  details = "The confidential mode analysis could not be completed. Please try again.",
  onRetry,
}: ConfidentialModeSuggestionErrorStateProps) {
  return (
    <section
      role="alert"
      aria-label="Confidential mode analysis error"
      className="mx-auto flex max-w-lg flex-col items-center justify-center px-4 py-12 text-center"
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
          type="button"
          onClick={onRetry}
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
        >
          <RotateCcw aria-hidden="true" className="size-4" />
          Retry
        </button>
      ) : null}
    </section>
  );
}

export type { ConfidentialModeSuggestionErrorStateProps };
