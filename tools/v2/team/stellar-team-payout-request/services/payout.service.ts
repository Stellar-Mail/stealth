/**
 * Payout Service
 *
 * Core business logic for payout request lifecycle.
 * All data is stored in-memory for the V2 isolated tool.
 * Do not wire into the main app or wallet core.
 */

import type { PayoutRequest, PayoutFormData, PayoutValidationResult, PayoutStatus } from "../types";
import { ValidationError } from "../types";

// ─── Validation ───────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** XLM amounts: positive number with at most 7 decimal places (1 stroop precision) */
const AMOUNT_RE = /^\d+(\.\d{1,7})?$/;
/** Stellar text memo max 28 bytes */
const MEMO_MAX_BYTES = 28;

function byteLength(str: string): number {
  return new TextEncoder().encode(str).length;
}

export function validatePayoutRequest(data: PayoutFormData): PayoutValidationResult {
  const errors: PayoutValidationResult["errors"] = {};

  if (!data.recipientEmail || !EMAIL_RE.test(data.recipientEmail)) {
    errors.recipientEmail = "A valid recipient email is required";
  }

  if (!data.amount || !AMOUNT_RE.test(data.amount) || parseFloat(data.amount) <= 0) {
    errors.amount = "Amount must be a positive number with at most 7 decimal places";
  }

  if (data.memo !== undefined && data.memo !== "" && byteLength(data.memo) > MEMO_MAX_BYTES) {
    errors.memo = `Memo must not exceed ${MEMO_MAX_BYTES} bytes`;
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

// ─── Service ──────────────────────────────────────────────────────────────────

class PayoutService {
  private readonly payouts = new Map<string, PayoutRequest>();

  createPayoutRequest(data: PayoutFormData): PayoutRequest {
    const validation = validatePayoutRequest(data);
    if (!validation.valid) {
      throw new ValidationError(validation.errors);
    }

    const now = new Date().toISOString();
    const payout: PayoutRequest = {
      id: `payout-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId: "local-user",
      recipientEmail: data.recipientEmail,
      amount: data.amount,
      asset: "native",
      memo: data.memo,
      status: "pending",
      scheduledFor: data.scheduledFor?.toISOString(),
      createdAt: now,
      updatedAt: now,
    };

    this.payouts.set(payout.id, payout);
    return payout;
  }

  getPayouts(): PayoutRequest[] {
    return Array.from(this.payouts.values());
  }

  getPayoutById(id: string): PayoutRequest | undefined {
    return this.payouts.get(id);
  }

  updateStatus(id: string, status: PayoutStatus, extra?: Partial<PayoutRequest>): PayoutRequest {
    const payout = this.payouts.get(id);
    if (!payout) throw new Error(`Payout not found: ${id}`);

    const updated: PayoutRequest = {
      ...payout,
      ...extra,
      status,
      updatedAt: new Date().toISOString(),
    };
    this.payouts.set(id, updated);
    return updated;
  }

  cancelPayout(id: string): PayoutRequest {
    return this.updateStatus(id, "cancelled");
  }

  /** Clear all in-memory data (useful for tests) */
  clear(): void {
    this.payouts.clear();
  }
}

export const payoutService = new PayoutService();
