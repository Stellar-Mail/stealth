import { useState, useCallback } from "react";
import type { PaymentRequest, ApprovalDecision } from "../types";

/**
 * usePaymentApproval Hook
 *
 * Manages the state of payment approval workflow locally.
 * Handles approval decisions, notes, and state transitions.
 */
interface UsePaymentApprovalOptions {
  onApprove?: (paymentId: string, notes?: string) => Promise<void>;
  onReject?: (paymentId: string, notes?: string) => Promise<void>;
}

export function usePaymentApproval(options: UsePaymentApprovalOptions = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Map<string, ApprovalDecision>>(new Map());

  const approve = useCallback(
    async (paymentId: string, notes?: string) => {
      setIsLoading(true);
      setError(null);

      try {
        if (options.onApprove) {
          await options.onApprove(paymentId, notes);
        }

        const decision: ApprovalDecision = {
          approverId: "current-user", // Will be replaced with actual user ID
          paymentId,
          decision: "approve",
          notes,
          decidedAt: new Date(),
        };

        setDecisions((prev) => new Map(prev).set(paymentId, decision));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to approve payment";
        setError(message);
        throw new Error(message);
      } finally {
        setIsLoading(false);
      }
    },
    [options],
  );

  const reject = useCallback(
    async (paymentId: string, notes?: string) => {
      setIsLoading(true);
      setError(null);

      try {
        if (options.onReject) {
          await options.onReject(paymentId, notes);
        }

        const decision: ApprovalDecision = {
          approverId: "current-user", // Will be replaced with actual user ID
          paymentId,
          decision: "reject",
          notes,
          decidedAt: new Date(),
        };

        setDecisions((prev) => new Map(prev).set(paymentId, decision));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to reject payment";
        setError(message);
        throw new Error(message);
      } finally {
        setIsLoading(false);
      }
    },
    [options],
  );

  const getDecision = useCallback((paymentId: string) => decisions.get(paymentId), [decisions]);

  const clearError = useCallback(() => setError(null), []);

  return {
    isLoading,
    error,
    decisions,
    approve,
    reject,
    getDecision,
    clearError,
  };
}

export type { UsePaymentApprovalOptions };
