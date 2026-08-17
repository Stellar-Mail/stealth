// useVendor hook
// Manages vendor data fetching and state

import { useState, useCallback, useMemo } from "react";
import type { Vendor, VendorFilter } from "../types";
import { getVendorService } from "../services";

export interface UseVendorOptions {
  vendorId?: string;
  autoFetch?: boolean;
}

export interface UseVendorState {
  vendor: Vendor | null;
  vendors: Vendor[];
  isLoading: boolean;
  error: Error | null;
  fetch: () => Promise<void>;
  fetchAll: (filter?: VendorFilter) => Promise<void>;
  create: (name: string, email: string) => Promise<Vendor>;
  update: (updates: Partial<Vendor>) => Promise<void>;
  delete: () => Promise<void>;
}

export function useVendor(options: UseVendorOptions = {}): UseVendorState {
  const { vendorId, autoFetch = true } = options;
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => getVendorService(), []);

  const fetch = useCallback(async () => {
    if (!vendorId) return;
    try {
      setIsLoading(true);
      setError(null);
      const result = await service.getVendor(vendorId);
      setVendor(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setIsLoading(false);
    }
  }, [service, vendorId]);

  const fetchAll = useCallback(
    async (filter?: VendorFilter) => {
      try {
        setIsLoading(true);
        setError(null);
        const results = await service.getVendors(filter);
        setVendors(results);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"));
      } finally {
        setIsLoading(false);
      }
    },
    [service],
  );

  const create = useCallback(
    async (name: string, email: string) => {
      try {
        setIsLoading(true);
        setError(null);
        const newVendor = await service.createVendor(name, email);
        setVendors((prev) => [...prev, newVendor]);
        return newVendor;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [service],
  );

  const update = useCallback(
    async (updates: Partial<Vendor>) => {
      if (!vendorId) throw new Error("No vendor ID set");
      try {
        setIsLoading(true);
        setError(null);
        const updated = await service.updateVendor(vendorId, updates);
        setVendor(updated);
        setVendors((prev) => prev.map((v) => (v.id === vendorId ? updated : v)));
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"));
      } finally {
        setIsLoading(false);
      }
    },
    [service, vendorId],
  );

  const deleteVendor = useCallback(async () => {
    if (!vendorId) throw new Error("No vendor ID set");
    try {
      setIsLoading(true);
      setError(null);
      await service.deleteVendor(vendorId);
      setVendor(null);
      setVendors((prev) => prev.filter((v) => v.id !== vendorId));
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setIsLoading(false);
    }
  }, [service, vendorId]);

  return {
    vendor,
    vendors,
    isLoading,
    error,
    fetch,
    fetchAll,
    create,
    update,
    delete: deleteVendor,
  };
}
