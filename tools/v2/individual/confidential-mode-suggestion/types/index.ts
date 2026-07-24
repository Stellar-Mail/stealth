export type ConfidentialSuggestionSeverity = "high" | "medium" | "low";

export type ConfidentialSuggestionCategory =
  | "confidential-mode"
  | "external-recipient"
  | "sensitive-content"
  | "attachment"
  | "expiration"
  | "passcode";

export interface ConfidentialSuggestion {
  id: string;
  title: string;
  description: string;
  category: ConfidentialSuggestionCategory;
  severity: ConfidentialSuggestionSeverity;
}

export interface ConfidentialModeResult {
  score: number;
  summary: string;
  suggestions: ConfidentialSuggestion[];
}

export interface ConfidentialModeInput {
  subject: string;
  body: string;
}
