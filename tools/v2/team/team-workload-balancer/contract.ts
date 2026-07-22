/**
 * contract.ts — Team Workload Balancer (non-UI execution contract)
 *
 * Backend-facing execution contract for distributing work items across team
 * members. It is presentation-free: no React, no DOM. Operations return a typed
 * `WorkloadResult<T>` discriminated union with explicit error codes instead of
 * throwing.
 *
 * The underlying balancing logic already exists in `./services/workload-service`
 * (`balanceWorkload`); this contract wraps it with a typed boundary.
 */

import { balanceWorkload } from "./services/workload-service";
import type { BalancerConfig, BalanceResult, TeamMember, WorkloadItem } from "./types";
/** Explicit, machine-readable error codes for contract operations. */
export enum WorkloadErrorCode {
  /** A required field was missing or failed validation. */
  InvalidInput = "INVALID_INPUT",
}

/** Discriminated outcome returned by every contract operation. */
export type WorkloadResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: WorkloadErrorCode; message: string };

/** Operations supported by the workload contract. */
export type WorkloadOperation = {
  operation: "balance";
  unassignedItems: WorkloadItem[];
  members: TeamMember[];
  allItems: WorkloadItem[];
  config: BalancerConfig;
};

/** Output produced by the contract, keyed by operation. */
export type WorkloadContractOutput = {
  operation: "balance";
  result: BalanceResult;
};

/** Backend-facing entry point for the team workload balancer. */
export interface WorkloadContract {
  execute(input: WorkloadOperation): WorkloadResult<WorkloadContractOutput>;
}

/** Typed success outcome. */
export function ok<T>(value: T): WorkloadResult<T> {
  return { ok: true, value };
}

/** Typed error outcome. */
export function fail<T = never>(error: WorkloadErrorCode, message: string): WorkloadResult<T> {
  return { ok: false, error, message };
}

/** Validate balance inputs. */
export function validateBalanceInput(input: WorkloadOperation): string | null {
  if (!Array.isArray(input.members)) return "members must be an array";
  if (!Array.isArray(input.allItems)) return "allItems must be an array";
  if (!Array.isArray(input.unassignedItems)) return "unassignedItems must be an array";
  if (!input.config || typeof input.config !== "object") return "config is required";
  if (!input.config.strategy) return "config.strategy is required";
  return null;
}

/**
 * Build the workload balancing execution contract.
 *
 * Pure: delegates to `balanceWorkload`, returning a typed result. The
 * underlying service is synchronous and free of UI concerns, so the contract is
 * fully testable in isolation with no network, no secrets, and no UI.
 */
export function createWorkloadContract(): WorkloadContract {
  return {
    execute(input: WorkloadOperation): WorkloadResult<WorkloadContractOutput> {
      try {
        if (input.operation !== "balance") {
          return fail(WorkloadErrorCode.InvalidInput, `Unknown operation: ${input.operation}`);
        }
        const err = validateBalanceInput(input);
        if (err) return fail(WorkloadErrorCode.InvalidInput, err);
        const result = balanceWorkload(
          input.unassignedItems,
          input.members,
          input.allItems,
          input.config,
        );
        return ok({ operation: "balance", result });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return fail(WorkloadErrorCode.InvalidInput, message);
      }
    },
  };
}
