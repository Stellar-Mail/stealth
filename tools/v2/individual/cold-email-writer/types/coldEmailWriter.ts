export type ColdEmailTone = "professional" | "friendly" | "direct";

export interface ColdEmailParty {
  name: string;
  company?: string;
  role?: string;
}

export interface ColdEmailWriterInput {
  requestId: string;
  sender: ColdEmailParty;
  recipient: ColdEmailParty;
  offer: string;
  valueProposition: string;
  callToAction: string;
  proofPoints?: string[];
  tone?: ColdEmailTone;
}

export interface ColdEmailWriterOptions {
  includeSubject?: boolean;
  maxBodyWords?: number;
}

export interface ColdEmailWriterOutput {
  requestId: string;
  subject: string | null;
  body: string;
  tone: ColdEmailTone;
  metadata: {
    wordCount: number;
    proofPointsUsed: number;
  };
}

export type ColdEmailWriterErrorCode =
  | "invalid-input"
  | "invalid-options"
  | "input-too-large"
  | "empty-content";

export interface ColdEmailWriterValidationIssue {
  code: ColdEmailWriterErrorCode;
  field?: string;
  message: string;
}

export type SafeColdEmailWriterResult =
  | { status: "ok"; result: ColdEmailWriterOutput }
  | {
      status: "error";
      code: ColdEmailWriterErrorCode;
      message: string;
      issues: ColdEmailWriterValidationIssue[];
    };
