import { PayoutRequest, Currency, ValidationResult, TeamMemberQuota } from "../types/payout";
import { MOCK_TEAM_MEMBERS } from "../fixtures/payout.fixtures";

export function validateStellarAddress(address: string): boolean {
  if (!address) return false;
  // A naive validation for a Stellar public key (Starts with G and is 56 characters long)
  // Real implementation would use Stellar SDK's StrKey.isValidEd25519PublicKey
  return /^G[A-Z2-7]{55}$/.test(address);
}

export function validatePayoutAmount(
  amount: number,
  currency: Currency,
  quota: TeamMemberQuota,
): ValidationResult {
  const errors: Record<string, string> = {};

  if (!quota.allowedCurrencies.includes(currency)) {
    errors.currency = `Currency ${currency} is not allowed for this member.`;
  }

  if (amount <= 0) {
    errors.amount = "Amount must be greater than zero.";
  } else if (amount > quota.maxAmountPerPayout[currency]) {
    errors.amount = `Amount exceeds allowed quota of ${quota.maxAmountPerPayout[currency]} ${currency}.`;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function estimateNetworkFee(currency: Currency): number {
  if (currency === "XLM") return 0.00001; // Base fee in XLM
  if (currency === "USDC") return 0.00001; // Fee is still paid in XLM, but represented roughly here
  return 0.01;
}

export function createPayoutRequest(
  teamMemberId: string,
  amount: number,
  currency: Currency,
  destinationAddress: string,
): { request?: PayoutRequest; errors?: Record<string, string> } {
  const quota = MOCK_TEAM_MEMBERS[teamMemberId];
  if (!quota) {
    return { errors: { teamMemberId: "Invalid team member ID." } };
  }

  const errors: Record<string, string> = {};

  if (!validateStellarAddress(destinationAddress)) {
    errors.destinationAddress = "Invalid Stellar destination address.";
  }

  const amountValidation = validatePayoutAmount(amount, currency, quota);
  if (!amountValidation.isValid) {
    Object.assign(errors, amountValidation.errors);
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  const request: PayoutRequest = {
    id: `req_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    teamMemberId,
    amount,
    currency,
    destinationAddress,
    status: "PENDING",
    createdAt: new Date().toISOString(),
    networkFeeEstimate: estimateNetworkFee(currency),
  };

  return { request };
}

export async function simulatePayoutExecution(request: PayoutRequest): Promise<PayoutRequest> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  // In a real app, this would submit the transaction to Stellar
  // Here we just return success deterministically for testing
  return {
    ...request,
    status: "COMPLETED",
  };
}
