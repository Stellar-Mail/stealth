/**
 * executionContract.ts — Shared Draft Collaboration (non-UI execution contract)
 *
 * Backend-facing, presentation-free execution contract for the shared draft
 * service. It wraps the existing `createDraftService` (which throws on invalid
 * input / missing drafts) and exposes a typed, non-throwing result contract so
 * callers — including any future UI — get an explicit success/error outcome
 * instead of catching exceptions.
 *
 * This module is ADDITIVE: it does not modify the service, types, or error
 * class shapes defined elsewhere in this folder (per the contributor boundary).
 */

import { createDraftService, type DraftService } from "./services/draft.service.mjs";
import type {
  CreateDraftInput,
  DraftFilter,
  DraftMetrics,
  SharedDraftData,
  UpdateDraftInput,
} from "./types";

/** Machine-readable error codes for contract operations. */
export enum DraftErrorCode {
  Validation = "VALIDATION_ERROR",
  NotFound = "NOT_FOUND",
  Limit = "LIMIT_ERROR",
  Unknown = "UNKNOWN_ERROR",
}

/** Discriminated outcome returned by every contract operation. */
export type DraftResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: DraftErrorCode; message: string; field?: string } };

/** Non-UI service entry point for the shared draft collaboration tool. */
export interface DraftExecutionContract {
  getDrafts: (filter?: DraftFilter) => Promise<DraftResult<SharedDraftData[]>>;
  addDraft: (input: CreateDraftInput) => Promise<DraftResult<SharedDraftData>>;
  updateDraft: (input: UpdateDraftInput) => Promise<DraftResult<SharedDraftData>>;
  removeDraft: (id: string) => Promise<DraftResult<void>>;
  setActive: (id: string) => Promise<DraftResult<SharedDraftData>>;
  getMetrics: () => Promise<DraftResult<DraftMetrics>>;
}

/**
 * Map a thrown service error to a typed contract error result.
 *
 * The underlying service signals failures by throwing either the
 * `DraftValidationError` class (from `guards/draft-guards.mjs`) or a plain
 * `Error` whose message contains "not found". We detect by `name`/message
 * rather than `instanceof` against the separate `errors.ts` class, since the
 * service does not use that one.
 */
function toResult<T>(err: unknown): DraftResult<T> {
  const message = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : "";
  const field = (err as { field?: string } | null)?.field;
  if (name === "DraftValidationError") {
    return { ok: false, error: { code: DraftErrorCode.Validation, message, field } };
  }
  if (/not found/i.test(message)) {
    return { ok: false, error: { code: DraftErrorCode.NotFound, message } };
  }
  return { ok: false, error: { code: DraftErrorCode.Unknown, message } };
}

/**
 * Build the shared-draft execution contract.
 *
 * Pure: delegates persistence to `createDraftService` (in-memory, seeded from
 * local fixtures). No network, no secrets. Every operation returns a typed
 * `DraftResult` and never rejects.
 */
export function createDraftExecutionContract(
  initialDrafts?: SharedDraftData[],
): DraftExecutionContract {
  const service: DraftService = createDraftService(initialDrafts);

  return {
    async getDrafts(filter) {
      try {
        return { ok: true, value: await service.getDrafts(filter) };
      } catch (err) {
        return toResult(err);
      }
    },
    async addDraft(input) {
      try {
        return { ok: true, value: await service.addDraft(input) };
      } catch (err) {
        return toResult(err);
      }
    },
    async updateDraft(input) {
      try {
        return { ok: true, value: await service.updateDraft(input) };
      } catch (err) {
        return toResult(err);
      }
    },
    async removeDraft(id) {
      try {
        await service.removeDraft(id);
        return { ok: true, value: undefined };
      } catch (err) {
        return toResult(err);
      }
    },
    async setActive(id) {
      try {
        return { ok: true, value: await service.setActive(id) };
      } catch (err) {
        return toResult(err);
      }
    },
    async getMetrics() {
      try {
        return { ok: true, value: await service.getMetrics() };
      } catch (err) {
        return toResult(err);
      }
    },
  };
}
