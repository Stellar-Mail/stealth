export type ConfidentialSuggestionStatus = "suggested" | "blocked" | "safe";
export type ConfidentialSignalSeverity = "high" | "medium" | "low";

export interface ConfidentialSignal {
  id: string;
  label: string;
  severity: ConfidentialSignalSeverity;
  evidence: string;
}

export interface ConfidentialSuggestion {
  id: string;
  draftTitle: string;
  recipientLabel: string;
  status: ConfidentialSuggestionStatus;
  recommendedMode: "confidential-mode" | "manual-review" | "standard-send";
  expiresIn?: string;
  preventForwarding: boolean;
  requirePasscode: boolean;
  signals: ConfidentialSignal[];
  reason: string;
  suggestedAction: string;
}

export interface ConfidentialModeSummary {
  totalSuggestions: number;
  suggested: number;
  blocked: number;
  safe: number;
}
