// Task Extractor — typed execution contract.
//
// Backend-facing types for the task-extractor tool. These types define the
// stable, non-UI contract between callers (services, jobs, tests) and the
// extraction engine. No presentation concerns belong here.

/** Urgency inferred from the language around a task. */
export type TaskPriority = "low" | "normal" | "high";

/** How much trust callers should place in an extracted task. */
export type TaskConfidence = "low" | "medium" | "high";

/** Which part of the message a task was found in. */
export type TaskSource = "subject" | "body";

/** Which rule produced a task candidate. */
export type TaskTrigger = "checkbox" | "request-phrase" | "bullet-action" | "imperative-line";

/** Input accepted by the extraction engine. */
export interface TaskExtractionInput {
  /** Stable caller-supplied identifier echoed back in the result. */
  messageId: string;
  /** Message subject line. May be empty when the body is not. */
  subject: string;
  /** Plain-text message body. May be empty when the subject is not. */
  body: string;
  /** Optional sender address, kept for correlation only — never analyzed. */
  senderAddress?: string;
  /**
   * Optional ISO 8601 timestamp of when the message was received. When
   * present, relative due phrases ("today", "tomorrow") resolve to dates.
   */
  receivedAt?: string;
  /**
   * Optional BCP 47 language tag. Only English ("en" or "en-*") is
   * supported; other values are rejected with "unsupported-language".
   */
  language?: string;
}

/** Tuning options for a single extraction call. */
export interface TaskExtractionOptions {
  /** Upper bound on returned tasks (1–50). Defaults to 10. */
  maxTasks?: number;
  /** Drop tasks below this confidence. Defaults to "low" (keep all). */
  minConfidence?: TaskConfidence;
}

/** One extracted action item. */
export interface ExtractedTask {
  /** Deterministic id: `<messageId>-task-<n>` in order of appearance. */
  id: string;
  /** The task text, trimmed and whitespace-collapsed. */
  text: string;
  /** Where the task was found. */
  source: TaskSource;
  /** Which rule matched. */
  trigger: TaskTrigger;
  /** Urgency inferred from surrounding language. */
  priority: TaskPriority;
  /** Trust level derived from the strength of the matching rule. */
  confidence: TaskConfidence;
  /** Resolved due date (YYYY-MM-DD) when one could be determined. */
  dueAtHint?: string;
  /** Raw due phrase (e.g. "by friday", "eod") when a date could not be resolved. */
  dueTextHint?: string;
}

/** Deterministic counters describing how the extraction ran. */
export interface TaskExtractionStats {
  /** Non-empty lines scanned across subject and body. */
  lineCount: number;
  /** Candidates matched by any rule before filtering and dedup. */
  candidateCount: number;
  /** Tasks returned after confidence filtering, dedup, and truncation. */
  extractedCount: number;
  /** True when maxTasks cut off further tasks. */
  truncated: boolean;
}

/** Successful extraction output. An empty task list is a valid outcome. */
export interface TaskExtractionResult {
  /** Echo of the input messageId. */
  messageId: string;
  /** Extracted tasks in order of appearance, truncated to maxTasks. */
  tasks: ExtractedTask[];
  /** Counters describing the extraction. */
  stats: TaskExtractionStats;
}

/** Machine-readable failure codes for the safe entry point. */
export type TaskExtractionErrorCode =
  | "invalid-input"
  | "invalid-options"
  | "input-too-large"
  | "empty-content"
  | "unsupported-language";

/** One validation problem, tied to a field when known. */
export interface TaskExtractionIssue {
  code: TaskExtractionErrorCode;
  /** Input field the issue applies to, when identifiable. */
  field?: string;
  message: string;
}

/** Discriminated result of the guarded entry point — never throws. */
export type SafeTaskExtractionResult =
  | { status: "ok"; result: TaskExtractionResult }
  | {
      status: "error";
      code: TaskExtractionErrorCode;
      message: string;
      issues: TaskExtractionIssue[];
    };
