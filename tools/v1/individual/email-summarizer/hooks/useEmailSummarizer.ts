import { useState, useCallback } from "react";
import type {
  NormalizedEmail,
  SummarizerOptions,
  SummarizerState,
} from "../services/emailSummarizer";
import { summarizeEmail, toReadyState } from "../services/emailSummarizer";

export interface UseEmailSummarizerReturn {
  state: SummarizerState;
  summarize: (email: NormalizedEmail, options?: SummarizerOptions) => void;
  reset: () => void;
}

export function useEmailSummarizer(): UseEmailSummarizerReturn {
  const [state, setState] = useState<SummarizerState>({ status: "idle" });

  const summarize = useCallback((email: NormalizedEmail, options: SummarizerOptions = {}) => {
    setState({ status: "loading" });
    const result = summarizeEmail(email, options);
    setState(toReadyState(result));
  }, []);

  const reset = useCallback(() => {
    setState({ status: "idle" });
  }, []);

  return { state, summarize, reset };
}
