/**
 * Shape required by a future inbox preview renderer.
 *
 * Produced by `toInboxPreviewData` from an admin `Draft`. All fields are
 * derived deterministically from the draft; no live data or secrets are used.
 */
export interface InboxPreviewItem {
  /** Stable identifier derived from the source draft id. */
  id: string;
  /** Email subject line. */
  subject: string;
  /** One-line preview extracted from the draft body. */
  preview: string;
  /** Primary recipient address (first entry in the draft recipients list). */
  primaryRecipient: string;
  /** All recipient addresses from the draft. */
  recipients: string[];
}
