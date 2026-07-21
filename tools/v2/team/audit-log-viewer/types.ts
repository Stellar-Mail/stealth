/**
 * types.ts — Audit Log Viewer (non-UI execution contract)
 *
 * Domain types for viewing administrative audit log entries. No imports
 * from the main app; presentation-free.
 */

export type AuditSeverity = "info" | "warning" | "critical";

/** A single administrative audit log entry. */
export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorEmail: string;
  action: string;
  resourceType: string;
  resourceId: string;
  /** ISO-8601 timestamp, e.g. "2026-06-01T09:30:00.000Z". */
  timestamp: string;
  severity: AuditSeverity;
  ipAddress: string;
}

/** Filters applicable when listing audit log entries. */
export interface AuditLogFilters {
  actorId?: string;
  action?: string;
  resourceType?: string;
  severity?: AuditSeverity;
  /** ISO-8601 inclusive lower bound on timestamp. */
  from?: string;
  /** ISO-8601 inclusive upper bound on timestamp. */
  to?: string;
}

/** Input for listing audit log entries. */
export interface ListEntriesInput {
  filters?: AuditLogFilters;
  limit?: number;
  offset?: number;
}

/** Output of a listEntries operation. */
export interface ListEntriesOutput {
  entries: AuditLogEntry[];
  totalCount: number;
}

/** Input for fetching a single audit log entry. */
export interface GetEntryInput {
  entryId: string;
}
