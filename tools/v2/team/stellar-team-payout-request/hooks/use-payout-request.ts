/**
 * usePayoutRequest Hook
 *
 * Manages the create/submit/cancel lifecycle for a single payout request.
 * All state is local to this hook. No connection to main app auth or wallet.
 */

import { useState, useCallback } from "react";
import type { PayoutRequest, PayoutFormData } from "../types";
import { payoutService } from "../services";

interface UsePayoutRequestResult {
  payout: PayoutRequest | null;
  isSubmitting: boolean;
  error: string | null;
  submit: (data: PayoutFormData) => Promise<void>;
  cancel: () => void;
  reset: () => void;
}

export function usePayoutRequest(): UsePayoutRequestResult {
  const [payout, setPayout] = useState<PayoutRequest | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async (data: PayoutFormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const created = payoutService.createPayoutRequest(data);
      setPayout(created);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create payout request";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const cancel = useCallback(() => {
    if (payout?.id) {
      const updated = payoutService.cancelPayout(payout.id);
      setPayout(updated);
    }
  }, [payout]);

  const reset = useCallback(() => {
    setPayout(null);
    setError(null);
  }, []);

  return { payout, isSubmitting, error, submit, cancel, reset };
}
