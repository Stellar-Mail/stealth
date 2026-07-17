import { useState, useCallback, useEffect } from "react";
import type { PaymentRequest } from "../types";

/**
 * usePaymentRequests Hook
 *
 * Manages fetching and filtering of payment requests locally.
 * Handles loading, error, and sorting states.
 */
interface UsePaymentRequestsOptions {
  initialPayments?: PaymentRequest[];
  onFetch?: () => Promise<PaymentRequest[]>;
}

export function usePaymentRequests(options: UsePaymentRequestsOptions = {}) {
  const { initialPayments, onFetch } = options;
  const [payments, setPayments] = useState<PaymentRequest[]>(initialPayments || []);
  const [isLoading, setIsLoading] = useState(!initialPayments);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (onFetch) {
        const data = await onFetch();
        setPayments(data);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch payments";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [onFetch]);

  // Fetch on mount if onFetch is provided
  useEffect(() => {
    if (onFetch && !initialPayments) {
      fetch();
    }
  }, [onFetch, initialPayments, fetch]);

  const filterByStatus = useCallback(
    (status: string) => {
      return payments.filter((p) => p.status === status);
    },
    [payments],
  );

  const filterByPriority = useCallback(
    (priority: string) => {
      return payments.filter((p) => p.priority === priority);
    },
    [payments],
  );

  const refresh = useCallback(async () => {
    await fetch();
  }, [fetch]);

  return {
    payments,
    isLoading,
    error,
    fetch,
    refresh,
    filterByStatus,
    filterByPriority,
  };
}

export type { UsePaymentRequestsOptions };
