/**
 * Types for the snooze metadata editor.
 *
 * These describe the reminder metadata attached to demo messages that appear in
 * the snoozed folder. All data is fake, deterministic, and safe for public
 * repository review.
 */

export type SnoozePresetId = "later-today" | "tomorrow" | "this-weekend" | "next-week";

/** Either a named preset or a hand-picked custom date/time. */
export type SnoozeChoice = SnoozePresetId | "custom";

export interface SnoozeMetadata {
  /** Local datetime the message should return to the inbox (`yyyy-MM-ddTHH:mm`). */
  remindAt: string;
  /** Which control produced this reminder. */
  choice: SnoozeChoice;
  /** Human label captured when the reminder was set, e.g. "Tomorrow". */
  label: string;
}

export interface SnoozedDemoMessage {
  /** Stable, unique identifier. */
  id: string;
  subject: string;
  from: string;
  /** Fake demo address. */
  email: string;
  snooze: SnoozeMetadata;
}
