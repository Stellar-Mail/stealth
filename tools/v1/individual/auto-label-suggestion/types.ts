export type AutoLabelConfidence = "high" | "medium" | "low";

export type AutoLabelStatus = "idle" | "loading" | "success" | "error";

export interface AutoLabelEmail {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  bodyPreview?: string;
  existingLabels?: string[];
  receivedAt?: string;
}

export interface AutoLabelSuggestion {
  label: string;
  confidence: AutoLabelConfidence;
  reason: string;
  evidence: string;
}

export interface AutoLabelSuccessResult {
  status: "success";
  suggestions: AutoLabelSuggestion[];
  preservedExistingLabels: string[];
  validationErrors: [];
  source: "local-deterministic-rules";
}

export interface AutoLabelErrorResult {
  status: "error";
  suggestions: [];
  preservedExistingLabels: string[];
  validationErrors: string[];
  source: "local-deterministic-rules";
}

export type AutoLabelResult = AutoLabelSuccessResult | AutoLabelErrorResult;
