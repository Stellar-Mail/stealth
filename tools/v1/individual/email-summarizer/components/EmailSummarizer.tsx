import type { JSX } from "react";
import type { SummarizerState } from "../services/emailSummarizer";
import { EmailSummaryEmpty } from "./EmailSummaryEmpty";
import { EmailSummaryLoading } from "./EmailSummaryLoading";
import { EmailSummaryError } from "./EmailSummaryError";
import { EmailSummaryView } from "./EmailSummaryView";

export interface EmailSummarizerProps {
  state: SummarizerState;
  onRetry?: () => void;
}

export function EmailSummarizer({ state, onRetry }: EmailSummarizerProps): JSX.Element {
  switch (state.status) {
    case "idle":
      return <EmailSummaryEmpty />;
    case "loading":
      return <EmailSummaryLoading />;
    case "error":
      return <EmailSummaryError code={state.code} message={state.message} onRetry={onRetry} />;
    case "ready":
      return <EmailSummaryView summary={state.summary} />;
  }
}
