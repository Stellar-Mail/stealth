// useVendorAnalytics hook
// Manages analytics and metrics aggregation

import { useState, useCallback, useMemo } from "react";
import type { VendorMetrics, AnalyticsSummary, AnalyticsFilter } from "../types";
import { getAnalyticsService } from "../services";

export interface UseVendorAnalyticsOptions {
  autoFetch?: boolean;
}

export interface UseVendorAnalyticsState {
  metrics: VendorMetrics | null;
  summary: AnalyticsSummary | null;
  topVendors: VendorMetrics[];
  isLoading: boolean;
  error: Error | null;
  fetchMetrics: (vendorId: string) => Promise<void>;
  fetchSummary: (filter?: AnalyticsFilter) => Promise<void>;
  fetchTopVendors: (limit?: number) => Promise<void>;
}

export function useVendorAnalytics(
  options: UseVendorAnalyticsOptions = {},
): UseVendorAnalyticsState {
  const { autoFetch = true } = options;
  const [metrics, setMetrics] = useState<VendorMetrics | null>(null);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [topVendors, setTopVendors] = useState<VendorMetrics[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => getAnalyticsService(), []);

  const fetchMetrics = useCallback(
    async (vendorId: string) => {
      try {
        setIsLoading(true);
        setError(null);
        const result = await service.getVendorMetrics(vendorId);
        setMetrics(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"));
      } finally {
        setIsLoading(false);
      }
    },
    [service],
  );

  const fetchSummary = useCallback(
    async (filter?: AnalyticsFilter) => {
      try {
        setIsLoading(true);
        setError(null);
        const result = await service.getSummary(filter);
        setSummary(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"));
      } finally {
        setIsLoading(false);
      }
    },
    [service],
  );

  const fetchTopVendors = useCallback(
    async (limit = 10) => {
      try {
        setIsLoading(true);
        setError(null);
        const results = await service.getTopVendors(limit);
        setTopVendors(results);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"));
      } finally {
        setIsLoading(false);
      }
    },
    [service],
  );

  return {
    metrics,
    summary,
    topVendors,
    isLoading,
    error,
    fetchMetrics,
    fetchSummary,
    fetchTopVendors,
  };
}
