/**
 * index.ts — Audit Log Viewer
 *
 * Folder-local API surface for the non-UI execution contract. Nothing in
 * this file imports React or touches the DOM.
 */

// Types
export type {
  AuditLogEntry,
  AuditSeverity,
  AuditLogFilters,
  ListEntriesInput,
  ListEntriesOutput,
  GetEntryInput,
} from "./types";

// Contract
export {
  AuditErrorCode,
  applyAuditOperation,
  validateListEntriesInput,
  validateGetEntryInput,
  MAX_PAGE_SIZE,
  ok,
  fail,
} from "./contract";
export type { AuditContract, AuditOperation, AuditContractOutput, AuditResult } from "./contract";

// Service (concrete, fixture-backed contract implementation)
export { createAuditLogContract } from "./services/execution.service";

// Fixtures
export {
  VALID_LIST_INPUT,
  VALID_GET_ENTRY_INPUT,
  INVALID_LIMIT_LIST_INPUT,
  OVERSIZED_LIMIT_LIST_INPUT,
  INVALID_DATE_RANGE_LIST_INPUT,
  MISSING_ENTRY_ID_INPUT,
  UNKNOWN_ENTRY_ID_INPUT,
} from "./fixtures/contractFixtures";
