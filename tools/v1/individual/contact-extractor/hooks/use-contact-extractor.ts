import { useCallback, useState } from "react";
import type {
  ExtractedContact,
  ContactExtractionResult,
  ExtractionOptions,
  ViewState,
} from "../types";
import {
  createContactExtractorService,
  type ContactExtractorServiceConfig,
} from "../services/contact-extractor.service";

export interface UseContactExtractorOptions {
  serviceConfig?: ContactExtractorServiceConfig;
}

export interface UseContactExtractorReturn {
  result: ContactExtractionResult | null;
  viewState: ViewState;
  error: string | null;
  extract: (rawEmail: string, options?: ExtractionOptions) => Promise<void>;
  reset: () => void;
  contacts: ExtractedContact[];
}

const defaultOptions: ExtractionOptions = {
  includeBody: true,
  dedupe: true,
};

export function useContactExtractor(
  options: UseContactExtractorOptions = {},
): UseContactExtractorReturn {
  const svc = createContactExtractorService(options.serviceConfig);
  const [result, setResult] = useState<ContactExtractionResult | null>(null);
  const [viewState, setViewState] = useState<ViewState>("input");
  const [error, setError] = useState<string | null>(null);

  const extract = useCallback(
    async (rawEmail: string, opts?: ExtractionOptions) => {
      setViewState("loading");
      setError(null);

      try {
        const mergedOptions = { ...defaultOptions, ...opts };
        const extractionResult = await svc.extractAsync(rawEmail, mergedOptions);

        if (extractionResult.contacts.length === 0) {
          setViewState("empty");
          setResult(extractionResult);
        } else {
          setViewState("success");
          setResult(extractionResult);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to extract contacts.";
        setError(message);
        setViewState("error");
      }
    },
    [svc],
  );

  const reset = useCallback(() => {
    setResult(null);
    setViewState("input");
    setError(null);
  }, []);

  return {
    result,
    viewState,
    error,
    extract,
    reset,
    contacts: result?.contacts ?? [],
  };
}
