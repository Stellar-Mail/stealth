export type ContactConfidence = "high" | "medium" | "low";

export type ExtractionStatus = "empty" | "idle" | "loading" | "success" | "error";

export interface ContactExtractionRequest {
  id: string;
  sourceLabel: string;
  subject: string;
  from: string;
  body: string;
}

export interface ExtractedContact {
  id: string;
  displayName: string;
  email?: string;
  phone?: string;
  organization?: string;
  confidence: ContactConfidence;
  evidence: string;
  warnings: string[];
}

export interface ContactExtractionResult {
  requestId: string;
  sourceLabel: string;
  status: "success" | "error";
  contacts: ExtractedContact[];
  error?: string;
}

export interface ContactExtractorState {
  status: ExtractionStatus;
  sourceText: string;
  selectedContactIds: string[];
  result?: ContactExtractionResult;
  error?: string;
}
