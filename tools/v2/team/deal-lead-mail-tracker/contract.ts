/**
 * Typed execution contract for Deal/Lead Mail Tracker.
 */

export interface DealLeadTrackerInput {
  emailId: string;
  senderAddress: string;
  recipientAddress: string;
  subject: string;
  contentBody: string;
  receivedAt: Date;
}

export interface DealLeadTrackerOutput {
  isDealLead: boolean;
  confidenceScore: number;
  extractedEntities?: {
    companyName?: string;
    contactName?: string;
    dealSize?: number;
    currency?: string;
  };
  processedAt: Date;
}

export enum DealLeadTrackerErrorCode {
  INVALID_INPUT = "INVALID_INPUT",
  PARSING_ERROR = "PARSING_ERROR",
  NETWORK_ERROR = "NETWORK_ERROR",
  INTERNAL_ERROR = "INTERNAL_ERROR",
}

export class DealLeadTrackerError extends Error {
  public readonly code: DealLeadTrackerErrorCode;

  constructor(message: string, code: DealLeadTrackerErrorCode) {
    super(message);
    this.name = "DealLeadTrackerError";
    this.code = code;
  }
}
