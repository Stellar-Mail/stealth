/**
 * Execution contract for Meeting Notes Extractor.
 * Non-UI, backend-facing types for meeting notes extraction.
 */

/** Error codes for meeting notes extraction failures */
export type MeetingNotesErrorCode =
  | "INVALID_INPUT"
  | "EMPTY_TRANSCRIPT"
  | "EXTRACTION_FAILED"
  | "FORMAT_UNSUPPORTED"
  | "PERSISTENCE_FAILED"
  | "INTERNAL_ERROR";

/** Input for meeting notes extraction */
export interface MeetingNotesInput {
  /** Raw meeting transcript text */
  transcript: string;
  /** Meeting title */
  title: string;
  /** Meeting date */
  date: string;
  /** Attendees list */
  attendees: string[];
  /** Preferred output format */
  format: "markdown" | "plain-text" | "json";
  /** Whether to extract action items */
  extractActionItems: boolean;
  /** Whether to extract key decisions */
  extractDecisions: boolean;
}

/** An extracted action item */
export interface ActionItem {
  /** Task description */
  description: string;
  /** Who is responsible */
  assignee?: string;
  /** Deadline if specified */
  deadline?: string;
}

/** An extracted decision */
export interface Decision {
  /** Decision summary */
  description: string;
  /** Who made the decision */
  decidedBy?: string;
}

/** Output from successful notes extraction */
export interface MeetingNotesOutput {
  /** Unique notes identifier */
  id: string;
  /** Meeting summary */
  summary: string;
  /** Extracted key points */
  keyPoints: string[];
  /** Extracted action items */
  actionItems: ActionItem[];
  /** Extracted decisions */
  decisions: Decision[];
  /** Output format used */
  format: "markdown" | "plain-text" | "json";
  /** When notes were generated */
  generatedAt: string;
}

/** Error result structure */
export interface MeetingNotesError {
  code: MeetingNotesErrorCode;
  message: string;
  /** Dot-path to invalid field when applicable */
  field?: string;
}

/** Discriminated union result type */
export type MeetingNotesResult =
  { ok: true; data: MeetingNotesOutput } | { ok: false; error: MeetingNotesError };

/** Execution function type signature */
export type ExecuteMeetingNotesExtractor = (
  input: MeetingNotesInput,
) => Promise<MeetingNotesResult>;
