import { Loader2 } from "lucide-react";

interface EmailTranslatorLoadingStateProps {
  message?: string;
}

/**
 * Loading state displayed during translation or detection.
 */
export function EmailTranslatorLoadingState({
  message = "Translating email...",
}: EmailTranslatorLoadingStateProps) {
  return (
    <section
      aria-busy="true"
      aria-label="Translation in progress"
      aria-live="polite"
      className="mx-auto flex max-w-lg flex-col items-center justify-center px-4 py-12 text-center"
      role="status"
    >
      <Loader2 aria-hidden="true" className="size-10 animate-spin text-slate-700" />
      <p className="mt-4 text-sm font-medium text-slate-900">{message}</p>
      <p className="mt-2 text-sm text-slate-600">This may take a few moments...</p>
    </section>
  );
}

export type { EmailTranslatorLoadingStateProps };
