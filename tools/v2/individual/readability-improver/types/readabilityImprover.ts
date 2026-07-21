// Readability Improver — typed execution contract.
//
// Backend-facing types for the readability-improver tool. These types define
// the stable, non-UI contract between callers (services, jobs, tests) and the
// analysis engine. No presentation concerns belong here.

/** Reading-ease band derived from the Flesch score. */
export type ReadabilityGrade = "very-easy" | "easy" | "medium" | "hard" | "very-hard";

/** How strongly an issue affects readability. */
export type IssueSeverity = "info" | "warn";

/** Which rule produced an issue. */
export type ReadabilityIssueType =
  | "long-sentence"
  | "complex-word"
  | "passive-voice"
  | "long-paragraph"
  | "shouting";

/** Where an issue was found. */
export type IssueSource = "subject" | "body";

/** Input accepted by the analysis engine. */
export interface ReadabilityInput {
  /** Stable caller-supplied identifier echoed back in the result. */
  messageId: string;
  /** Message subject line. May be empty when the body is not. */
  subject: string;
  /** Plain-text message body. May be empty when the subject is not. */
  body: string;
  /** Optional sender address, kept for correlation only — never analyzed. */
  senderAddress?: string;
  /** Optional ISO 8601 timestamp of when the message was received. */
  receivedAt?: string;
  /**
   * Optional BCP 47 language tag. Only English ("en" or "en-*") is
   * supported; other values are rejected with "unsupported-language".
   */
  language?: string;
}

/** Tuning options for a single analysis call. */
export interface ReadabilityOptions {
  /** Include per-finding issues in the result. Defaults to true. */
  includeIssues?: boolean;
  /** Upper bound on returned issues (1–100). Defaults to 25. */
  maxIssues?: number;
}

/** One readability finding with a concrete improvement suggestion. */
export interface ReadabilityIssue {
  /** Which rule matched. */
  type: ReadabilityIssueType;
  /** info = stylistic hint, warn = strong readability drag. */
  severity: IssueSeverity;
  /** Where the finding is located. */
  source: IssueSource;
  /** Snippet of the offending text, capped at 80 characters. */
  excerpt: string;
  /** Actionable, human-readable improvement suggestion. */
  suggestion: string;
}

/** Deterministic metrics describing the analyzed text. */
export interface ReadabilityMetrics {
  wordCount: number;
  sentenceCount: number;
  paragraphCount: number;
  /** Rounded to 1 decimal; 0 when there are no sentences. */
  averageWordsPerSentence: number;
  /** Sentences above the long-sentence threshold. */
  longSentenceCount: number;
  /** Words with three or more syllables. */
  complexWordCount: number;
}

/** Counters describing how the issue scan ran. */
export interface ReadabilityStats {
  /** Findings matched before truncation. */
  issueCandidates: number;
  /** Findings returned after truncation. */
  issueCount: number;
  /** True when maxIssues cut off further findings. */
  truncated: boolean;
}

/** Successful analysis output. An empty issue list is a valid outcome. */
export interface ReadabilityResult {
  /** Echo of the input messageId. */
  messageId: string;
  /** Flesch reading ease clamped to [0, 100], rounded to 1 decimal. */
  score: number;
  /** Reading-ease band derived from the score. */
  grade: ReadabilityGrade;
  /** Findings in order of appearance, truncated to maxIssues. */
  issues: ReadabilityIssue[];
  /** Deterministic text metrics. */
  metrics: ReadabilityMetrics;
  /** Scan counters. */
  stats: ReadabilityStats;
}

/** Machine-readable failure codes for the safe entry point. */
export type ReadabilityErrorCode =
  | "invalid-input"
  | "invalid-options"
  | "input-too-large"
  | "empty-content"
  | "unsupported-language";

/** One validation problem, tied to a field when known. */
export interface ReadabilityValidationIssue {
  code: ReadabilityErrorCode;
  /** Input field the issue applies to, when identifiable. */
  field?: string;
  message: string;
}

/** Discriminated result of the guarded entry point — never throws. */
export type SafeReadabilityResult =
  | { status: "ok"; result: ReadabilityResult }
  | {
      status: "error";
      code: ReadabilityErrorCode;
      message: string;
      issues: ReadabilityValidationIssue[];
    };
