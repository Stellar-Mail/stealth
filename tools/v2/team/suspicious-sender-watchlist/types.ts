/**
 * types.ts — Suspicious Sender Watchlist
 *
 * All domain types for this tool. No imports from main app.
 *
 * Inputs:  WatchlistEntry, AddEntryInput, UpdateRiskInput, WatchlistFilter
 * Outputs: WatchlistState, WatchlistMetrics, FetchState<T>
 */

/** Risk severity assigned to a flagged sender. */
export type RiskLevel = "low" | "medium" | "high";

/** Status of a watchlist entry. */
export type EntryStatus = "active" | "dismissed";

/** A single suspicious-sender watchlist entry. */
export interface WatchlistEntry {
  id: string;
  senderEmail: string;
  senderName: string;
  /** Human-readable reason for flagging this sender. */
  reason: string;
  riskLevel: RiskLevel;
  status: EntryStatus;
  /** ISO-8601 date string, e.g. "2026-01-15" */
  dateAdded: string;
  /** Optional free-text notes from the reviewer. */
  notes?: string;
}

/** Payload for adding a new entry. */
export interface AddEntryInput {
  senderEmail: string;
  senderName: string;
  reason: string;
  riskLevel: RiskLevel;
  notes?: string;
}

/** Payload for updating the risk level of an existing entry. */
export interface UpdateRiskInput {
  id: string;
  riskLevel: RiskLevel;
}

/** Filter applied when querying the watchlist. */
export interface WatchlistFilter {
  riskLevel?: RiskLevel;
  status?: EntryStatus;
  search?: string;
}

/** Aggregate metrics derived from the watchlist. */
export interface WatchlistMetrics {
  total: number;
  highRisk: number;
  mediumRisk: number;
  lowRisk: number;
  active: number;
  dismissed: number;
}

/**
 * Generic fetch-state discriminated union.
 * Used by the hook to express loading / error / empty / success.
 *
 * Loading state: { status: "loading" }
 * Error state:   { status: "error"; message: string }
 * Empty state:   { status: "empty" }
 * Success state: { status: "success"; data: T }
 */
export type FetchState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "empty" }
  | { status: "success"; data: T };
