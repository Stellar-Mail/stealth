/**
 * contract.ts — Stellar Team Payout Request (non-UI execution contract)
 *
 * Backend-facing execution contract for payout request operations. It is
 * presentation-free: no React, no DOM. Operations return a typed
 * `PayoutResult<T>` discriminated union with explicit error codes instead of
 * throwing.
 *
 * The underlying stateful logic already exists in `./services/payout.service.ts`
 * (`createPayoutService`, which throws errors for validation and not-found conditions);
 * this contract wraps it so callers receive typed results rather than catching exceptions.
 */

import type { PayoutFormData, PayoutRequest } from "./types";
import { createPayoutService } from "./services/payout.service";

/** Explicit, machine-readable error codes for contract operations. */
export enum PayoutErrorCode {
  /** Input failed validation (missing/empty fields, invalid format). */
  VALIDATION_ERROR = "VALIDATION_ERROR",
  /** Payout request not found. */
  NOT_FOUND = "NOT_FOUND",
  /** Invalid operation for current payout status. */
  INVALID_OPERATION = "INVALID_OPERATION",
  /** Generic error for unexpected failures. */
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

/** Contract operation types. */
export type PayoutOperation =
  | { type: "createPayout"; data: PayoutFormData; userId?: string }
  | { type: "getPayouts"; userId?: string }
  | { type: "getPayoutById"; id: string }
  | { type: "cancelPayout"; id: string }
  | { type: "retryPayout"; id: string }
  | { type: "updatePayoutStatus"; id: string; status: "submitted" | "confirmed" | "failed"; transactionId?: string; error?: string };

/** Contract output types. */
export type PayoutContractOutput =
  | { type: "payout"; payout: PayoutRequest }
  | { type: "payouts"; payouts: PayoutRequest[] }
  | { type: "success"; message: string };

/** Discriminated union result type. */
export type PayoutResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: PayoutErrorCode; message: string };

/** Main contract function. */
export function createPayoutContract() {
  const service = createPayoutService();

  function execute(operation: PayoutOperation): PayoutResult<PayoutContractOutput> {
    try {
      switch (operation.type) {
        case "createPayout": {
          const payout = service.createPayoutRequest(operation.data, operation.userId);
          return { ok: true, data: { type: "payout", payout } };
        }

        case "getPayouts": {
          const payouts = service.getPayouts(operation.userId);
          return { ok: true, data: { type: "payouts", payouts } };
        }

        case "getPayoutById": {
          const payout = service.getPayoutById(operation.id);
          if (!payout) {
            return {
              ok: false,
              error: PayoutErrorCode.NOT_FOUND,
              message: `Payout ${operation.id} not found`,
            };
          }
          return { ok: true, data: { type: "payout", payout } };
        }

        case "cancelPayout": {
          service.cancelPayout(operation.id);
          return { ok: true, data: { type: "success", message: "Payout cancelled" } };
        }

        case "retryPayout": {
          const payout = service.retryPayout(operation.id);
          return { ok: true, data: { type: "payout", payout } };
        }

        case "updatePayoutStatus": {
          const payout = service.updatePayoutStatus(
            operation.id,
            operation.status,
            operation.transactionId,
            operation.error,
          );
          return { ok: true, data: { type: "payout", payout } };
        }

        default: {
          // TypeScript exhaustiveness check
          const _exhaustive: never = operation;
          return _exhaustive;
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // Map error messages to error codes
      if (message.includes("Validation failed")) {
        return {
          ok: false,
          error: PayoutErrorCode.VALIDATION_ERROR,
          message,
        };
      }

      if (message.includes("not found")) {
        return {
          ok: false,
          error: PayoutErrorCode.NOT_FOUND,
          message,
        };
      }

      if (message.includes("Cannot") && message.includes("status")) {
        return {
          ok: false,
          error: PayoutErrorCode.INVALID_OPERATION,
          message,
        };
      }

      return {
        ok: false,
        error: PayoutErrorCode.UNKNOWN_ERROR,
        message,
      };
    }
  }

  return { execute };
}
