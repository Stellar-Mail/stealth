/**
 * Stellar Team Payout Request — Payout Service
 *
 * Core business logic for managing payout requests in memory.
 * No live network calls, no Stellar SDK, no secrets.
 * External submission is handled by a future integration layer.
 */

import type { PayoutFormData, PayoutRequest, PayoutStatus, ValidationResult } from "../types";
import { validatePayoutFormData } from "./validation";

/** Incrementing counter used to generate deterministic IDs in tests. */
let _idCounter = 0;

function generateId(): string {
  return `payout-${Date.now()}-${++_idCounter}`;
}

function now(): string {
  return new Date().toISOString();
}

export class PayoutService {
  private store: Map<string, PayoutRequest> = new Map();

  // ── Validation ─────────────────────────────────────────────────────────────

  /**
   * Validates form data without creating a request.
   *
   * Input:  PayoutFormData
   * Output: ValidationResult { valid, errors }
   */
  validate(data: PayoutFormData): ValidationResult {
    return validatePayoutFormData(data);
  }

  // ── Create ──────────────────────────────────────────────────────────────────

  /**
   * Creates a new payout request.
   *
   * Input:  valid PayoutFormData + userId
   * Output: PayoutRequest with status "pending"
   * Error:  throws Error when validation fails (errors attached as `.errors`)
   */
  create(userId: string, data: PayoutFormData): PayoutRequest {
    const validation = this.validate(data);
    if (!validation.valid) {
      const err = new Error("Invalid payout form data");
      (err as Error & { errors: Record<string, string> }).errors = validation.errors;
      throw err;
    }

    const timestamp = now();
    const request: PayoutRequest = {
      id: generateId(),
      userId,
      recipientEmail: data.recipientEmail.trim(),
      amount: data.amount.trim(),
      ...(data.memo?.trim() ? { memo: data.memo.trim() } : {}),
      ...(data.scheduledFor ? { scheduledFor: data.scheduledFor } : {}),
      status: "pending",
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.store.set(request.id, request);
    return { ...request };
  }

  // ── Read ────────────────────────────────────────────────────────────────────

  /**
   * Returns a copy of the request or undefined.
   *
   * Input:  payout ID
   * Output: PayoutRequest | undefined
   */
  getById(id: string): PayoutRequest | undefined {
    const req = this.store.get(id);
    return req ? { ...req } : undefined;
  }

  /**
   * Returns all requests for a given user.
   *
   * Input:  userId
   * Output: PayoutRequest[]
   */
  getByUser(userId: string): PayoutRequest[] {
    return Array.from(this.store.values())
      .filter((r) => r.userId === userId)
      .map((r) => ({ ...r }));
  }

  /**
   * Returns all requests with a specific status.
   *
   * Input:  PayoutStatus
   * Output: PayoutRequest[]
   */
  getByStatus(status: PayoutStatus): PayoutRequest[] {
    return Array.from(this.store.values())
      .filter((r) => r.status === status)
      .map((r) => ({ ...r }));
  }

  // ── Status transitions ──────────────────────────────────────────────────────

  /**
   * Marks a pending request as submitted with a transaction ID.
   *
   * Input:  payout ID, Stellar transaction hash
   * Output: updated PayoutRequest
   * Error:  throws when not found or not in "pending" status
   */
  markSubmitted(id: string, transactionId: string): PayoutRequest {
    const req = this._requirePayout(id);
    this._requireStatus(req, ["pending"]);

    const updated: PayoutRequest = {
      ...req,
      status: "submitted",
      transactionId,
      submittedAt: now(),
      updatedAt: now(),
    };
    this.store.set(id, updated);
    return { ...updated };
  }

  /**
   * Marks a submitted request as confirmed.
   *
   * Input:  payout ID
   * Output: updated PayoutRequest
   * Error:  throws when not found or not in "submitted" status
   */
  markConfirmed(id: string): PayoutRequest {
    const req = this._requirePayout(id);
    this._requireStatus(req, ["submitted"]);

    const updated: PayoutRequest = {
      ...req,
      status: "confirmed",
      confirmedAt: now(),
      updatedAt: now(),
    };
    this.store.set(id, updated);
    return { ...updated };
  }

  /**
   * Marks a request as failed with an error message.
   *
   * Input:  payout ID, error message
   * Output: updated PayoutRequest
   * Error:  throws when not found or already confirmed/cancelled
   */
  markFailed(id: string, error: string): PayoutRequest {
    const req = this._requirePayout(id);
    this._requireStatus(req, ["pending", "submitted"]);

    const updated: PayoutRequest = {
      ...req,
      status: "failed",
      error,
      updatedAt: now(),
    };
    this.store.set(id, updated);
    return { ...updated };
  }

  /**
   * Cancels a pending request.
   *
   * Input:  payout ID
   * Output: updated PayoutRequest
   * Error:  throws when not found or not in "pending" status
   */
  cancel(id: string): PayoutRequest {
    const req = this._requirePayout(id);
    this._requireStatus(req, ["pending"]);

    const updated: PayoutRequest = { ...req, status: "cancelled", updatedAt: now() };
    this.store.set(id, updated);
    return { ...updated };
  }

  // ── Misc ────────────────────────────────────────────────────────────────────

  /** Clears all stored requests (useful for test isolation). */
  clear(): void {
    this.store.clear();
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private _requirePayout(id: string): PayoutRequest {
    const req = this.store.get(id);
    if (!req) throw new Error(`Payout not found: ${id}`);
    return req;
  }

  private _requireStatus(req: PayoutRequest, allowed: PayoutStatus[]): void {
    if (!allowed.includes(req.status)) {
      throw new Error(
        `Cannot transition payout ${req.id} from "${req.status}". ` +
          `Allowed source statuses: ${allowed.join(", ")}.`,
      );
    }
  }
}

/** Module-level singleton for convenience. */
export const payoutService = new PayoutService();
