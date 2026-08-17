import { useCallback } from "react";
import type { ViewState } from "../types";
import { useContactExtractor } from "../hooks/use-contact-extractor";
import { ContactInputPanel } from "./ContactInputPanel";
import { ExtractedContactList } from "./ExtractedContactList";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { LoadingState } from "./LoadingState";
import { SuccessState } from "./SuccessState";

export interface ContactExtractorConsoleProps {
  className?: string;
}

export function ContactExtractorConsole({ className = "" }: ContactExtractorConsoleProps) {
  const { viewState, error, extract, reset, contacts } = useContactExtractor();

  const handleExtract = useCallback(
    (rawEmail: string) => {
      extract(rawEmail);
    },
    [extract],
  );

  const handleRetry = useCallback(() => {
    reset();
  }, [reset]);

  const viewStates: Record<ViewState, React.ReactNode> = {
    input: <ContactInputPanel onExtract={handleExtract} isLoading={false} />,
    loading: (
      <>
        <ContactInputPanel onExtract={handleExtract} isLoading={true} />
        <LoadingState />
      </>
    ),
    error: (
      <ErrorState
        error={error ?? "An unexpected error occurred."}
        onRetry={handleRetry}
        onReset={reset}
      />
    ),
    empty: <EmptyState onReset={reset} />,
    success: (
      <div className="space-y-4">
        <SuccessState contactCount={contacts.length} onReset={reset} />
        <ExtractedContactList contacts={contacts} />
      </div>
    ),
  };

  return (
    <div
      className={`w-full max-w-2xl mx-auto ${className}`}
      role="region"
      aria-label="Contact Extractor tool"
    >
      <div className="space-y-4">{viewStates[viewState]}</div>
    </div>
  );
}
