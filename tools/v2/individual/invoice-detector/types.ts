export type InvoiceDetectorErrorCode = "EMPTY_INPUT" | "UNSUPPORTED_CONTENT" | "INVALID_INPUT";

export interface InvoiceDetectorInput {
  text: string;
  locale?: string;
  referenceDate?: string;
}

export interface InvoiceRecord {
  vendorName: string;
  invoiceNumber: string;
  totalAmount: number;
  currency: string;
  detectedAt: string;
}

export interface InvoiceDetectorError {
  code: InvoiceDetectorErrorCode;
  message: string;
  retryable: boolean;
}

export interface InvoiceDetectorSuccess {
  ok: true;
  invoice: InvoiceRecord;
}

export interface InvoiceDetectorFailure {
  ok: false;
  invoice: null;
  error: InvoiceDetectorError;
}

export type InvoiceDetectorResult = InvoiceDetectorSuccess | InvoiceDetectorFailure;
