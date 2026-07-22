// Draft Improver — typed backend-facing execution contract.
//
// This module defines the stable input/output shape for the draft-improver
// service without introducing UI-specific concepts such as layout, styling, or
// presentation state.

export type DraftImproverIssueType =
  | "clarity"
  | "conciseness"
  | "tone"
  | "structure"
  | "grammar";

export type DraftImproverSeverity = "info" | "warn";

export interface DraftImproverInput {
  messageId: string;
  subject: string;
  body: string;
  senderAddress?: string;
  receivedAt?: string;
  language?: string;
}

export interface DraftImproverOptions {
  includeSuggestions?: boolean;
  maxSuggestions?: number;
}

export interface DraftImproverIssue {
  type: DraftImproverIssueType;
  severity: DraftImproverSeverity;
  excerpt: string;
  suggestion: string;
}

export interface DraftImproverMetrics {
  wordCount: number;
  sentenceCount: number;
  readabilityScore: number;
}

export interface DraftImproverResult {
  messageId: string;
  improvedSubject: string;
  improvedBody: string;
  score: number;
  issues: DraftImproverIssue[];
  metrics: DraftImproverMetrics;
}

export type DraftImproverErrorCode =
  | "invalid-input"
  | "invalid-options"
  | "input-too-large"
  | "empty-content"
  | "unsupported-language";

export interface DraftImproverValidationIssue {
  code: DraftImproverErrorCode;
  field?: string;
  message: string;
}

export type SafeDraftImproverResult =
  | { status: "ok"; result: DraftImproverResult }
  | {
      status: "error";
      code: DraftImproverErrorCode;
      message: string;
      issues: DraftImproverValidationIssue[];
    };
