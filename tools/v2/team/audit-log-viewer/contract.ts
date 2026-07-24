/**
 * contract.ts — Audit Log Viewer (non-UI execution contract)
 *
 * Backend-facing execution contract for viewing administrative audit log
 * entries. Presentation-free: no React, no DOM. Read-only — this tool views
 * an existing audit trail, it does not write to it. Operations return a
 * typed `AuditResult<T>` discriminated union with explicit error codes
 * instead of throwing.
 */

import type {
  AuditLogEntry,
  AuditLogFilters,
  GetEntryInput,
  ListEntriesInput,
  ListEntriesOutput,
} from "./types";

/** Explicit, machine-readable error codes for contract operations. */
export enum AuditErrorCode {
  /** A required field was missing or failed validation. */
  InvalidInput = "INVALID_INPUT",
  /** The referenced audit log entry was not found. */
  EntryNotFound = "ENTRY_NOT_FOUND",
}

/** Discriminated outcome returned by every contract operation. */
export type AuditResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: AuditErrorCode; message: string };

/** Operations supported by the audit log viewer contract. */
export type AuditOperation =
  | { operation: "listEntries"; input: ListEntriesInput }
  | { operation: "getEntry"; input: GetEntryInput };

/** Output produced by the contract, keyed by operation. */
export type AuditContractOutput =
  | { operation: "listEntries"; result: ListEntriesOutput }
  | { operation: "getEntry"; entry: AuditLogEntry };

/** Backend-facing entry point for the audit log viewer. */
export interface AuditContract {
  execute(op: AuditOperation): Promise<AuditResult<AuditContractOutput>>;
}

/** Typed success outcome. */
export function ok<T>(value: T): AuditResult<T> {
  return { ok: true, value };
}

/** Typed error outcome. */
export function fail<T = never>(error: AuditErrorCode, message: string): AuditResult<T> {
  return { ok: false, error, message };
}

/** Max entries a single listEntries call may return in one pass. */
export const MAX_PAGE_SIZE = 200;

/** Validate a listEntries operation's input. Returns a message or null. */
export function validateListEntriesInput(input: ListEntriesInput): string | null {
  if (input.limit !== undefined && (input.limit <= 0 || !Number.isInteger(input.limit))) {
    return "limit must be a positive integer";
  }
  if (input.limit !== undefined && input.limit > MAX_PAGE_SIZE) {
    return `limit exceeds max page size of ${MAX_PAGE_SIZE}`;
  }
  if (input.offset !== undefined && (input.offset < 0 || !Number.isInteger(input.offset))) {
    return "offset must be a non-negative integer";
  }
  if (input.filters?.from && Number.isNaN(Date.parse(input.filters.from))) {
    return "filters.from must be a valid ISO-8601 timestamp";
  }
  if (input.filters?.to && Number.isNaN(Date.parse(input.filters.to))) {
    return "filters.to must be a valid ISO-8601 timestamp";
  }
  if (
    input.filters?.from &&
    input.filters?.to &&
    Date.parse(input.filters.from) > Date.parse(input.filters.to)
  ) {
    return "filters.from must not be after filters.to";
  }
  return null;
}

/** Validate a getEntry operation's input. Returns a message or null. */
export function validateGetEntryInput(input: GetEntryInput): string | null {
  if (!input.entryId || input.entryId.trim() === "") return "entryId is required";
  return null;
}

function applyFilters(entries: AuditLogEntry[], filters?: AuditLogFilters): AuditLogEntry[] {
  if (!filters) return entries;
  let out = entries;
  if (filters.actorId) out = out.filter((e) => e.actorId === filters.actorId);
  if (filters.action) out = out.filter((e) => e.action === filters.action);
  if (filters.resourceType) out = out.filter((e) => e.resourceType === filters.resourceType);
  if (filters.severity) out = out.filter((e) => e.severity === filters.severity);
  if (filters.from) {
    const from = Date.parse(filters.from);
    out = out.filter((e) => Date.parse(e.timestamp) >= from);
  }
  if (filters.to) {
    const to = Date.parse(filters.to);
    out = out.filter((e) => Date.parse(e.timestamp) <= to);
  }
  return out;
}

/**
 * Pure reducer for the audit log viewer.
 *
 * Reads from `entries`; never mutates it. Deterministic given inputs. The
 * service layer wraps this with real fixtures/delay.
 */
export function applyAuditOperation(
  entries: Map<string, AuditLogEntry>,
  op: AuditOperation,
): AuditResult<AuditContractOutput> {
  switch (op.operation) {
    case "listEntries": {
      const err = validateListEntriesInput(op.input);
      if (err) return fail(AuditErrorCode.InvalidInput, err);

      const all = [...entries.values()].sort(
        (a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp),
      );
      const filtered = applyFilters(all, op.input.filters);
      const offset = op.input.offset ?? 0;
      const limit = op.input.limit ?? 50;
      const page = filtered.slice(offset, offset + limit);

      return ok({
        operation: "listEntries",
        result: { entries: page, totalCount: filtered.length },
      });
    }
    case "getEntry": {
      const err = validateGetEntryInput(op.input);
      if (err) return fail(AuditErrorCode.InvalidInput, err);

      const entry = entries.get(op.input.entryId);
      if (!entry) {
        return fail(AuditErrorCode.EntryNotFound, `AuditLogEntry ${op.input.entryId} not found`);
      }
      return ok({ operation: "getEntry", entry });
    }
    default: {
      const _never: never = op;
      return fail(AuditErrorCode.InvalidInput, `Unknown operation: ${JSON.stringify(_never)}`);
    }
  }
}
