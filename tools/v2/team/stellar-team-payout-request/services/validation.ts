/**
 * Stellar Team Payout Request — Validation Helpers
 *
 * Pure functions. No side effects, no network calls, no external state.
 */

import type { PayoutFormData, ValidationResult } from "../types";

// Stellar public key: starts with 'G', 56 alphanumeric chars (base32 encoded).
const STELLAR_PUBLIC_KEY_RE = /^G[A-Z2-7]{55}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** XLM memo text is limited to 28 bytes. */
const MEMO_MAX_BYTES = 28;

/** Returns true when the string is a valid-looking email address. */
export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

/**
 * Returns true when the string is a syntactically valid Stellar public key.
 * Does NOT confirm account existence on-chain.
 */
export function isValidStellarAccountId(id: string): boolean {
  return STELLAR_PUBLIC_KEY_RE.test(id.trim());
}

/**
 * Returns true when the amount string represents a positive number
 * with at most 7 decimal places (XLM precision).
 */
export function isValidAmount(amount: string): boolean {
  const trimmed = amount.trim();
  if (!trimmed) return false;
  const n = Number(trimmed);
  if (!isFinite(n) || n <= 0) return false;
  // XLM supports up to 7 decimal places (1 stroop = 0.0000001 XLM).
  const match = trimmed.match(/^(\d+)(?:\.(\d+))?$/);
  if (!match) return false;
  const decimals = match[2] ?? "";
  return decimals.length <= 7;
}

/**
 * Returns true when the memo fits within the 28-byte UTF-8 limit
 * imposed by the Stellar memo-text field.
 */
export function isValidMemo(memo: string): boolean {
  return new TextEncoder().encode(memo).byteLength <= MEMO_MAX_BYTES;
}

/**
 * Validates all fields in PayoutFormData.
 * Returns a ValidationResult with field-keyed error messages.
 */
export function validatePayoutFormData(data: PayoutFormData): ValidationResult {
  const errors: Record<string, string> = {};

  if (!data.recipientEmail || !isValidEmail(data.recipientEmail)) {
    errors.recipientEmail = "A valid recipient email address is required.";
  }

  if (!data.amount || !isValidAmount(data.amount)) {
    errors.amount = "Amount must be a positive number with at most 7 decimal places.";
  }

  if (data.memo !== undefined && data.memo !== "" && !isValidMemo(data.memo)) {
    errors.memo = `Memo must not exceed ${MEMO_MAX_BYTES} bytes.`;
  }

  if (data.scheduledFor !== undefined) {
    const d = new Date(data.scheduledFor);
    if (isNaN(d.getTime())) {
      errors.scheduledFor = "Scheduled date must be a valid ISO-8601 date string.";
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
