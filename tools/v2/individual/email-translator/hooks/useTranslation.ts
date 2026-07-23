import { useState, useCallback } from "react";
import type { TranslationRequest, TranslationResult, TranslationError } from "../types";
import { translationService } from "../services";

interface UseTranslationOptions {
  sourceLanguage?: string;
  targetLanguage?: string;
}

interface UseTranslationReturn {
  translatedText: string | null;
  isTranslating: boolean;
  error: TranslationError | null;
  translate: (text: string, sourceLanguage: string, targetLanguage: string) => Promise<void>;
  reset: () => void;
}

/**
 * Hook for managing translation state and operations.
 */
export function useTranslation(options: UseTranslationOptions = {}): UseTranslationReturn {
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<TranslationError | null>(null);

  const translate = useCallback(
    async (text: string, sourceLanguage: string, targetLanguage: string) => {
      setIsTranslating(true);
      setError(null);
      setTranslatedText(null);

      const request: TranslationRequest = {
        text,
        sourceLanguage,
        targetLanguage,
      };

      const result = await translationService.translate(request);

      if (result.success) {
        setTranslatedText(result.result.translatedText);
      } else {
        setError(result.error);
      }

      setIsTranslating(false);
    },
    [],
  );

  const reset = useCallback(() => {
    setTranslatedText(null);
    setError(null);
    setIsTranslating(false);
  }, []);

  return {
    translatedText,
    isTranslating,
    error,
    translate,
    reset,
  };
}
