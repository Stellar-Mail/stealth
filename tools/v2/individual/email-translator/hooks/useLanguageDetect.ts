import { useState, useEffect, useCallback } from "react";
import { translationService } from "../services";

interface UseLanguageDetectOptions {
  text: string;
  enabled?: boolean;
  debounceMs?: number;
}

interface UseLanguageDetectReturn {
  detectedLanguage: string | null;
  confidence: number | null;
  isDetecting: boolean;
  error: string | null;
  detect: () => Promise<void>;
}

/**
 * Hook for automatic language detection with debouncing.
 */
export function useLanguageDetect({
  text,
  enabled = true,
  debounceMs = 500,
}: UseLanguageDetectOptions): UseLanguageDetectReturn {
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detect = useCallback(async () => {
    if (!text.trim()) {
      setDetectedLanguage(null);
      setConfidence(null);
      setError(null);
      return;
    }

    setIsDetecting(true);
    setError(null);

    const result = await translationService.detectLanguage(text);

    if ("error" in result) {
      setError(result.error.message);
      setDetectedLanguage(null);
      setConfidence(null);
    } else {
      setDetectedLanguage(result.language);
      setConfidence(result.confidence);
      setError(null);
    }

    setIsDetecting(false);
  }, [text]);

  // Debounced auto-detection
  useEffect(() => {
    if (!enabled || !text.trim()) {
      setDetectedLanguage(null);
      setConfidence(null);
      return;
    }

    const timer = setTimeout(() => {
      detect();
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [text, enabled, debounceMs, detect]);

  return {
    detectedLanguage,
    confidence,
    isDetecting,
    error,
    detect,
  };
}
