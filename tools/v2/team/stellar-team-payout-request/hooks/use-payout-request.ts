import { useState, useCallback } from "react";
import type { PayoutRequest, PayoutFormValues, PayoutStatus } from "../types";

interface UsePayoutRequestOptions {
  initialPayouts?: PayoutRequest[];
  onSubmit?: (values: PayoutFormValues) => Promise<void>;
}

interface UsePayoutRequestReturn {
  payouts: PayoutRequest[];
  isLoading: boolean;
  error: string | null;
  submit: (values: PayoutFormValues) => Promise<void>;
  clearError: () => void;
  /** Update local status of a payout (optimistic UI) */
  updateStatus: (id: string, status: PayoutStatus) => void;
}

/**
 * usePayoutRequest
 *
 * Local state hook for the Stellar Team Payout Request tool.
 * Does not connect to any backend or Stellar network directly —
 * consumers pass their own onSubmit handler.
 */
export function usePayoutRequest({
  initialPayouts = [],
  onSubmit,
}: UsePayoutRequestOptions = {}): UsePayoutRequestReturn {
  const [payouts, setPayouts] = useState<PayoutRequest[]>(initialPayouts);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (values: PayoutFormValues) => {
      setIsLoading(true);
      setError(null);
      try {
        await onSubmit?.(values);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Submission failed.";
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [onSubmit],
  );

  const clearError = useCallback(() => setError(null), []);

  const updateStatus = useCallback((id: string, status: PayoutStatus) => {
    setPayouts((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
  }, []);

  return { payouts, isLoading, error, submit, clearError, updateStatus };
}
