/**
 * execution-contract.ts — Suspicious Sender Watchlist
 *
 * Non-UI service entry point. Adapts the existing presentation-agnostic
 * `createWatchlistService` into the typed `WatchlistContract` (see contract.ts),
 * converting thrown errors into explicit WatchlistResult outcomes.
 *
 * This is the single backend-facing boundary the issue asks for: callers invoke
 * `execute(...)` and receive a typed success/error result, with no UI concerns.
 */

import type { WatchlistService } from "./watchlist.service";
import {
  WatchlistErrorCode,
  type WatchlistContract,
  type WatchlistContractInput,
  type WatchlistContractOutput,
  type WatchlistResult,
  fail,
} from "../contract";

/**
 * Build the watchlist execution contract from an underlying service.
 *
 * @param service The presentation-agnostic watchlist service to adapt.
 */
export function createWatchlistContract(service: WatchlistService): WatchlistContract {
  return {
    async execute(
      input: WatchlistContractInput,
    ): Promise<WatchlistResult<WatchlistContractOutput>> {
      try {
        switch (input.operation) {
          case "list": {
            const entries = await service.getEntries(input.filter ?? {});
            return {
              ok: true,
              value: { operation: "list", entries },
            };
          }
          case "add": {
            const entry = await service.addEntry(input.input);
            return { ok: true, value: { operation: "add", entry } };
          }
          case "updateRisk": {
            const entry = await service.updateRisk(input.input);
            return { ok: true, value: { operation: "updateRisk", entry } };
          }
          case "dismiss": {
            const entry = await service.dismissEntry(input.id);
            return { ok: true, value: { operation: "dismiss", entry } };
          }
          case "remove": {
            await service.removeEntry(input.id);
            return { ok: true, value: { operation: "remove", removedId: input.id } };
          }
          case "metrics": {
            const metrics = await service.getMetrics();
            return { ok: true, value: { operation: "metrics", metrics } };
          }
          default: {
            // Exhaustiveness guard for future operation additions.
            const _never: never = input;
            return fail(
              WatchlistErrorCode.InvalidInput,
              `Unknown operation: ${JSON.stringify(_never)}`,
            );
          }
        }
      } catch (err) {
        return mapError(err);
      }
    },
  };
}

/** Map a thrown error onto the explicit contract error code. */
function mapError(err: unknown): WatchlistResult<never> {
  const message = err instanceof Error ? err.message : String(err);
  if (/not found/i.test(message)) {
    return fail(WatchlistErrorCode.EntryNotFound, message);
  }
  if (/validation|invalid/i.test(message)) {
    return fail(WatchlistErrorCode.InvalidInput, message);
  }
  return fail(WatchlistErrorCode.BackendFailure, message);
}
