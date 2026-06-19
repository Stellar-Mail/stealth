// useTracking hook
// Manages communication tracking and history

import { useState, useCallback, useMemo } from "react";
import type {
  CommunicationRecord,
  TrackingFilter,
  VendorTrackingStats,
  CommunicationType,
  CommunicationStatus,
} from "../types";
import { getTrackingService } from "../services";

export interface UseTrackingOptions {
  vendorId?: string;
  autoFetch?: boolean;
}

export interface UseTrackingState {
  records: CommunicationRecord[];
  stats: VendorTrackingStats | null;
  isLoading: boolean;
  error: Error | null;
  fetchRecords: (filter?: TrackingFilter) => Promise<void>;
  fetchStats: () => Promise<void>;
  recordCommunication: (
    vendorId: string,
    type: string,
    subject?: string,
    preview?: string,
  ) => Promise<void>;
  updateRecordStatus: (recordId: string, status: string) => Promise<void>;
}

export function useTracking(options: UseTrackingOptions = {}): UseTrackingState {
  const { vendorId, autoFetch = true } = options;
  const [records, setRecords] = useState<CommunicationRecord[]>([]);
  const [stats, setStats] = useState<VendorTrackingStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => getTrackingService(), []);

  const fetchRecords = useCallback(
    async (filter?: TrackingFilter) => {
      try {
        setIsLoading(true);
        setError(null);
        const results = await service.getRecords(filter);
        setRecords(results);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"));
      } finally {
        setIsLoading(false);
      }
    },
    [service],
  );

  const fetchStats = useCallback(async () => {
    if (!vendorId) return;
    try {
      setIsLoading(true);
      setError(null);
      const result = await service.getVendorStats(vendorId);
      setStats(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setIsLoading(false);
    }
  }, [service, vendorId]);

  const recordCommunication = useCallback(
    async (vendorId: string, type: string, subject?: string, preview?: string) => {
      try {
        setIsLoading(true);
        setError(null);
        const record = await service.recordCommunication(
          vendorId,
          type as CommunicationType,
          subject,
          preview,
        );
        setRecords((prev) => [...prev, record]);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"));
      } finally {
        setIsLoading(false);
      }
    },
    [service],
  );

  const updateRecordStatus = useCallback(
    async (recordId: string, status: string) => {
      try {
        setIsLoading(true);
        setError(null);
        await service.updateRecordStatus(recordId, status as CommunicationStatus);
        setRecords((prev) =>
          prev.map((r) =>
            r.id === recordId ? { ...r, status: status as CommunicationStatus } : r,
          ),
        );
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"));
      } finally {
        setIsLoading(false);
      }
    },
    [service],
  );

  return {
    records,
    stats,
    isLoading,
    error,
    fetchRecords,
    fetchStats,
    recordCommunication,
    updateRecordStatus,
  };
}
