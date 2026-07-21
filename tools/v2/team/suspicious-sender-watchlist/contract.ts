/**
 * contract.ts — Suspicious Sender Watchlist (non-UI execution contract)
 *
 * This file is the backend-facing execution contract for the watchlist tool.
 * It is deliberately presentation-free: no React, no DOM, no hooks. It defines
 * the typed inputs, outputs, and explicit error codes so the watchlist can be
 * invoked as a stable service independent of any UI.
 *
 * The contract is expressed as a discriminated result type (WatchlistResult)
 * instead of throwing, so callers (UI or future integrations) get a typed
 * success/error outcome rather than an untyped exception.
 */

import type {
  AddEntryInput,
  UpdateRiskInput,
  WatchlistEntry,
  WatchlistFilter,
  WatchlistMetrics,
} from "./types";

/** Explicit, machine-readable error codes for contract operations. */
export enum WatchlistErrorCode {
  /** A required field was missing or failed validation. */
  InvalidInput = "INVALID_INPUT",
  /** The referenced entry id does not exist in the store. */
  EntryNotFound = "ENTRY_NOT_FOUND",
  /** The operation failed due to a (simulated) backend fault. */
  BackendFailure = "BACKEND_FAILURE",
  /** The provided filter could not be applied. */
  InvalidFilter = "INVALID_FILTER",
}

/** Discriminated outcome returned by every contract operation. */
export type WatchlistResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: WatchlistErrorCode; message: string };

/** Inputs accepted by the contract, keyed by operation. */
export type WatchlistContractInput =
  | { operation: "list"; filter?: WatchlistFilter }
  | { operation: "add"; input: AddEntryInput }
  | { operation: "updateRisk"; input: UpdateRiskInput }
  | { operation: "dismiss"; id: string }
  | { operation: "remove"; id: string }
  | { operation: "metrics" };

/** Outputs produced by the contract, keyed by operation. */
export type WatchlistContractOutput =
  | { operation: "list"; entries: WatchlistEntry[] }
  | { operation: "add"; entry: WatchlistEntry }
  | { operation: "updateRisk"; entry: WatchlistEntry }
  | { operation: "dismiss"; entry: WatchlistEntry }
  | { operation: "remove"; removedId: string }
  | { operation: "metrics"; metrics: WatchlistMetrics };

/**
 * Backend-facing entry point for the watchlist.
 *
 * Wraps the existing presentation-agnostic service and converts its
 * throw-based API into the typed WatchlistResult contract, so callers never
 * have to catch untyped exceptions.
 */
export interface WatchlistContract {
  execute(input: WatchlistContractInput): Promise<WatchlistResult<WatchlistContractOutput>>;
}

/** Shape a successful or failed outcome without throwing. */
export function ok<T>(value: T): WatchlistResult<T> {
  return { ok: true, value };
}

export function fail<T = never>(error: WatchlistErrorCode, message: string): WatchlistResult<T> {
  return { ok: false, error, message };
}
