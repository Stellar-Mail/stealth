import { AlertCircle } from "lucide-react";

interface EmailTranslatorErrorStateProps {
  details?: string;
  onRetry?: () => void;
  title?: string;
}

/**
 * Error state displayed when translation fails.
 */
export function EmailTranslatorErrorState({
  details,
  onRetry,
  title = "Translation failed",
}: EmailTranslatorErrorStateProps) {
  return (
    <section
      aria-label="Translation error"
      className="mx-auto flex max-w-lg flex-col items-center justify-center px-4 py-12 text-center"
      role="alert"
    >
      <div
        aria-hidden="true"
        className="mb-5 flex size-14 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700"
      >
        <AlertCircle className="size-7" />
      </div>
      <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
      {details && <p className="mt-3 text-sm leading-6 text-muted-foreground">{details}</p>}
      {onRetry && (
        <button
          className="mt-6 inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
          onClick={onRetry}
          type="button"
        >
          Try again
        </button>
      )}
    </section>
  );
}

export type { EmailTranslatorErrorStateProps };
