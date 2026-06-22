import { useState, useCallback } from "react";
import type { CalendarEvent, CalendarExtractionRequest, ExtractionResult } from "../types";
import { calendarService } from "../services";

/**
 * useCalendarExtraction Hook
 *
 * Manages the state of calendar extraction workflow locally.
 * Handles extraction requests, event processing, and state transitions.
 */
interface UseCalendarExtractionOptions {
  onExtract?: (request: CalendarExtractionRequest) => Promise<ExtractionResult>;
}

export function useCalendarExtraction(options: UseCalendarExtractionOptions = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Map<string, ExtractionResult>>(new Map());

  const extract = useCallback(
    async (request: CalendarExtractionRequest): Promise<ExtractionResult | undefined> => {
      setIsLoading(true);
      setError(null);

      try {
        let result: ExtractionResult;

        if (options.onExtract) {
          result = await options.onExtract(request);
        } else {
          // Use simulated extraction by default
          const sourceEvents = request.events.length > 0 ? request.events : [];
          result = await calendarService.simulateExtraction(request, sourceEvents);
        }

        setResults((prev) => new Map(prev).set(request.id, result));
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to extract calendar events";
        setError(message);
        throw new Error(message);
      } finally {
        setIsLoading(false);
      }
    },
    [options],
  );

  const getResult = useCallback((requestId: string) => results.get(requestId), [results]);

  const clearError = useCallback(() => setError(null), []);

  const clearResults = useCallback(() => setResults(new Map()), []);

  return {
    isLoading,
    error,
    results,
    extract,
    getResult,
    clearError,
    clearResults,
  };
}

export type { UseCalendarExtractionOptions };
