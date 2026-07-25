export type PayoutStatus =
  | "PENDING"
  | "VALIDATING"
  | "APPROVED"
  | "REJECTED"
  | "COMPLETED"
  | "ERROR";
export type Currency = "XLM" | "USDC";

export interface PayoutRequest {
  id: string;
  teamMemberId: string;
  amount: number;
  currency: Currency;
  destinationAddress: string;
  status: PayoutStatus;
  createdAt: string;
  errorMessage?: string;
  networkFeeEstimate?: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export interface TeamMemberQuota {
  teamMemberId: string;
  allowedCurrencies: Currency[];
  maxAmountPerPayout: Record<Currency, number>;
}

export interface PayoutState {
  status: "idle" | "loading" | "success" | "error";
  request: PayoutRequest | null;
  validationErrors?: Record<string, string>;
  globalError?: string;
}
