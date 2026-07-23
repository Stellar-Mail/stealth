/**
 * SLA Deadline Tracker — shared types (#450).
 *
 * Folder-local types only. No imports from the main application.
 */

/** A tracked work item whose response SLA we are monitoring. */
export interface SlaTrackedItem {
  id: string;
  /** Human-readable label (email subject, ticket title, conversation id). */
  label: string;
  /** ISO-8601 timestamp when the clock started (e.g. message received). */
  startedAt: string;
  /** ISO-8601 timestamp of the response deadline, or null if no SLA applies. */
  deadlineAt: string | null;
  /** True once a response has been recorded (SLA satisfied). */
  responded: boolean;
  /** ISO-8601 timestamp of the response, or null if not yet responded. */
  respondedAt: string | null;
}

/**
 * An SLA policy. `warnWindowMs` defines the "due soon" threshold: an item is
 * considered at risk when its remaining time drops below this window but has
 * not yet breached.
 */
export interface SlaPolicy {
  /** Total allowed response time, in milliseconds. */
  responseBudgetMs: number;
  /** Lead time before the deadline at which an item becomes "due soon". */
  warnWindowMs: number;
}

/** Computed status for a single tracked item at a given moment. */
export type SlaStatus = "responded" | "on-track" | "due-soon" | "breached";

export interface SlaEvaluation {
  itemId: string;
  status: SlaStatus;
  /** Milliseconds remaining until the deadline (negative once breached). */
  remainingMs: number;
  /** True if the item breached its deadline without a response. */
  breached: boolean;
  /** True once a response has been recorded. */
  responded: boolean;
}

/** Aggregate view across a collection of tracked items. */
export interface SlaSummary {
  total: number;
  responded: number;
  onTrack: number;
  dueSoon: number;
  breached: number;
}
