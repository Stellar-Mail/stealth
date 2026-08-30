/** BETA-096 / BETA-098 — privacy-safe beta feedback payload (no message bodies or secrets). */

export type BetaFeedbackCategory =
  | "comprehension"
  | "accessibility"
  | "performance"
  | "recovery"
  | "other";

export interface BetaFeedbackPayload {
  /** Session correlation id (random, non-PII). */
  sessionId: string;
  /** Journey task identifier from the acceptance script. */
  taskId: string;
  category: BetaFeedbackCategory;
  /** 1 = blocked, 5 = effortless */
  rating: 1 | 2 | 3 | 4 | 5;
  /** Optional short note; redacted before persistence. */
  note?: string;
  /** Participant confirmed test-data + diagnostic consent. */
  informedConsent: boolean;
  /** viewport label e.g. desktop | mobile */
  viewport: "desktop" | "mobile";
  /** ISO timestamp */
  submittedAt: string;
}

export interface BetaFeedbackSubmissionResult {
  ok: boolean;
  redacted: BetaFeedbackPayload;
}
