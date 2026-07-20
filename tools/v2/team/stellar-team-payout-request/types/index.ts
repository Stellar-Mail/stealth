export interface PayoutRequest {
  id: string;
  userId: string;
  recipientEmail: string;
  recipientStellarId?: string;
  amount: string; // In XLM, string for precision
  memo?: string;
  status: "pending" | "submitted" | "confirmed" | "failed";
  transactionId?: string;
  error?: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  scheduledFor?: string; // ISO 8601, optional
  submittedAt?: string;
  confirmedAt?: string;
}

export interface PayoutFormData {
  recipientEmail: string;
  amount: string;
  memo?: string;
  scheduledFor?: string; // ISO 8601 string
}

export interface StellarTransaction {
  id: string;
  sourceAccount: string;
  destinationAccount: string;
  amount: string;
  asset: "native" | string; // 'native' for XLM
  memo?: string;
  fee: string; // In stroops (1 XLM = 10^7 stroops)
  ledger: number;
  createdAt: string;
}

export interface StellarAccount {
  id: string;
  balance: string;
  sequenceNumber: string;
  subentryCount: number;
}

export interface TransactionResult {
  id: string;
  status: "success" | "failure";
  ledger: number;
  timestamp: string;
}

export interface TransactionStatus {
  status: "pending" | "confirmed" | "failed";
  confirmations: number;
  error?: string;
}
