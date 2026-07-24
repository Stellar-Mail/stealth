export type DraftInputId = string;

export type DraftIssueCategory =
  | "spelling"
  | "grammar"
  | "clarity"
  | "tone"
  | "length"
  | "structure"
  | "action-item"
  | "missing-field"
  | "sensitive-content";

export type DraftIssueSeverity = "error" | "warning" | "info";

export type DraftSuggestionType = "replace" | "insert" | "remove" | "rewrite";

export interface DraftInput {
  id: DraftInputId;
  subject: string;
  body: string;
  recipientName?: string;
  senderName?: string;
  maxSubjectLength?: number;
  maxBodyLength?: number;
  containsPersonalData: boolean;
}

export interface ParsedDraft {
  subject: string;
  body: string;
  recipientName: string;
  senderName: string;
  subjectLength: number;
  bodyLength: number;
  bodyWordCount: number;
  bodySentenceCount: number;
  hasGreeting: boolean;
  hasClosing: boolean;
  hasActionItem: boolean;
  hasAttachment: boolean;
}

export interface SanitizedDraft {
  subject: string;
  body: string;
  recipientName: string;
  senderName: string;
  wasTruncated: boolean;
  wasSanitized: boolean;
  originalSubjectLength: number;
  originalBodyLength: number;
}

export interface DraftSuggestion {
  type: DraftSuggestionType;
  category: DraftIssueCategory;
  severity: DraftIssueSeverity;
  message: string;
  originalText?: string;
  suggestedText?: string;
  position?: {
    start: number;
    end: number;
  };
}

export interface DraftIssue {
  category: DraftIssueCategory;
  severity: DraftIssueSeverity;
  message: string;
  suggestions: DraftSuggestion[];
}

export interface DraftScore {
  overall: number;
  subject: number;
  body: number;
  clarity: number;
  tone: number;
  structure: number;
}

export interface DraftImprovementResult {
  inputId: DraftInputId;
  parsed: ParsedDraft;
  sanitized: SanitizedDraft;
  issues: DraftIssue[];
  suggestions: DraftSuggestion[];
  score: DraftScore;
  summary: string;
  totalIssues: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
}

export interface DraftImproverServiceOptions {
  maxSubjectLength?: number;
  maxBodyLength?: number;
  maxInputSizeBytes?: number;
  enableSensitiveContentCheck?: boolean;
  enableSpellCheck?: boolean;
  locale?: string;
}
