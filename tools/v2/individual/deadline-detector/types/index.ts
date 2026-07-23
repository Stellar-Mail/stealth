/**
 * Folder-local domain types for the Deadline Detector tool.
 *
 * These describe the isolated detection contract only. They intentionally avoid
 * any dependency on the main app, mailbox, calendar, or Stellar core so the
 * tool can be reviewed as a self-contained mini-product.
 */

/** Stable, fixture-local identifier for a source message. */
export type DeadlineSourceId = string;

/** Stable, fixture-local identifier for a detected deadline. */
export type DeadlineId = string;

/** Message category used to give reviewers context. */
export type DeadlineSourceType =
  | "invoice"
  | "renewal"
  | "request"
  | "reminder"
  | "newsletter"
  | "digest"
  | "notification"
  | "other";

/** Lifecycle state assigned to each detected deadline. */
export type DeadlineStatus = "detected" | "needs-review" | "missed" | "ignored";

/** Relative urgency bucket derived from the due date and the run date. */
export type DeadlineUrgency = "overdue" | "today" | "soon" | "later" | "unknown";

/** A message-like input. All fields are synthetic and folder-local. */
export interface DeadlineMessage {
  id: DeadlineSourceId;
  type: DeadlineSourceType;
  sender: string;
  subject: string;
  body: string;
  /** ISO-8601 timestamp for when the message was received. */
  receivedAt: string;
  /** Always false for local fixtures; no personal data is used. */
  containsPersonalData: boolean;
  /** Timezone label surfaced in the UI (e.g. "UTC"). */
  userTimezone: string;
}

/** A single reviewable deadline candidate produced by the detector. */
export interface DetectedDeadline {
  id: DeadlineId;
  sourceMessageId: DeadlineSourceId;
  title: string;
  /** ISO date (YYYY-MM-DD) or null when no date could be extracted. */
  dueDate: string | null;
  /** 24-hour time (HH:MM) or null when no time could be extracted. */
  dueTime: string | null;
  timezone: string;
  status: DeadlineStatus;
  urgency: DeadlineUrgency;
  /** Detection confidence from 0 through 1. */
  confidence: number;
  /** True unless the result is a high-confidence detected deadline. */
  reviewRequired: boolean;
}

/** Aggregate counts across a detection run. */
export interface DeadlineDetectionSummary {
  total: number;
  detected: number;
  needsReview: number;
  missed: number;
  ignored: number;
}

/** Full result of a detection run. */
export interface DeadlineDetectionResult {
  deadlines: DetectedDeadline[];
  summary: DeadlineDetectionSummary;
}

/** Options controlling a detection run. Defaults keep runs deterministic. */
export interface DeadlineDetectorServiceOptions {
  /**
   * Reference "now" used for urgency and missed classification. Accepts an ISO
   * string or Date. Defaults to the current time when omitted.
   */
  now?: string | Date;
  /** Number of days ahead that still counts as "soon". Defaults to 3. */
  soonWindowDays?: number;
}
