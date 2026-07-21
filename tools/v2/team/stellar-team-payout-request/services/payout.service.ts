import type { PayoutRequest, PayoutFormData } from "../types";

export function validatePayoutRequest(data: PayoutFormData): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (!data.recipientEmail || !data.recipientEmail.includes("@")) {
    errors.recipientEmail = "Invalid email format";
  }

  if (!data.amount || isNaN(Number(data.amount)) || Number(data.amount) <= 0) {
    errors.amount = "Amount must be a positive number";
  }

  // Check for max 2 decimal places
  if (data.amount && data.amount.includes(".")) {
    const decimals = data.amount.split(".")[1];
    if (decimals.length > 2) {
      errors.amount = "Amount can have at most 2 decimal places";
    }
  }

  if (data.memo && data.memo.length > 28) {
    errors.memo = "Memo must be 28 bytes or less";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function createPayoutService() {
  let payouts: PayoutRequest[] = [];
  let idCounter = 0;

  function generateId(): string {
    idCounter++;
    return `payout-${String(idCounter).padStart(4, "0")}`;
  }

  function createPayoutRequest(
    data: PayoutFormData,
    userId: string = "default-user",
  ): PayoutRequest {
    const validation = validatePayoutRequest(data);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${JSON.stringify(validation.errors)}`);
    }

    const now = new Date().toISOString();
    const payout: PayoutRequest = {
      id: generateId(),
      userId,
      recipientEmail: data.recipientEmail,
      amount: data.amount,
      memo: data.memo,
      status: "pending",
      createdAt: now,
      updatedAt: now,
      scheduledFor: data.scheduledFor,
    };

    payouts = [...payouts, payout];
    return payout;
  }

  function getPayouts(userId: string = "default-user"): PayoutRequest[] {
    return payouts.filter((p) => p.userId === userId);
  }

  function getPayoutById(id: string): PayoutRequest | null {
    return payouts.find((p) => p.id === id) || null;
  }

  function cancelPayout(id: string): void {
    const payout = getPayoutById(id);
    if (!payout) {
      throw new Error(`Payout ${id} not found`);
    }
    if (payout.status !== "pending") {
      throw new Error(`Cannot cancel payout with status ${payout.status}`);
    }

    payouts = payouts.map((p) =>
      p.id === id
        ? { ...p, status: "failed", error: "Cancelled by user", updatedAt: new Date().toISOString() }
        : p,
    );
  }

  function retryPayout(id: string): PayoutRequest {
    const payout = getPayoutById(id);
    if (!payout) {
      throw new Error(`Payout ${id} not found`);
    }
    if (payout.status !== "failed") {
      throw new Error(`Cannot retry payout with status ${payout.status}`);
    }

    const updated: PayoutRequest = {
      ...payout,
      status: "pending",
      error: undefined,
      updatedAt: new Date().toISOString(),
    };

    payouts = payouts.map((p) => (p.id === id ? updated : p));
    return updated;
  }

  function updatePayoutStatus(
    id: string,
    status: "submitted" | "confirmed" | "failed",
    transactionId?: string,
    error?: string,
  ): PayoutRequest {
    const payout = getPayoutById(id);
    if (!payout) {
      throw new Error(`Payout ${id} not found`);
    }

    const now = new Date().toISOString();
    const updated: PayoutRequest = {
      ...payout,
      status,
      transactionId,
      error,
      updatedAt: now,
      ...(status === "submitted" && { submittedAt: now }),
      ...(status === "confirmed" && { confirmedAt: now }),
    };

    payouts = payouts.map((p) => (p.id === id ? updated : p));
    return updated;
  }

  return {
    createPayoutRequest,
    getPayouts,
    getPayoutById,
    cancelPayout,
    retryPayout,
    updatePayoutStatus,
  };
}
