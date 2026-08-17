/**
 * Formatting utilities for proof record display in the admin dashboard.
 *
 * All functions are pure and work on plain strings — no external dependencies.
 */

import type { ProofPostageStatus, ProofRecord } from "./types/proofRecord";

/** Human-readable labels for each postage status. */
export const POSTAGE_STATUS_LABEL: Record<ProofPostageStatus, string> = {
  pending: "Pending",
  settled: "Settled",
  refunded: "Refunded",
};

/**
 * Truncate a hash string to a short preview suitable for table cells.
 * Keeps the `0x` prefix plus `prefixLen` leading hex chars and `suffixLen` trailing chars.
 *
 * @example
 * truncateHash("0xabcdef1234567890", 4, 4) // "0xabcd…7890"
 */
export function truncateHash(hash: string, prefixLen = 6, suffixLen = 4): string {
  const body = hash.startsWith("0x") ? hash.slice(2) : hash;
  if (body.length <= prefixLen + suffixLen) return hash;
  return `0x${body.slice(0, prefixLen)}\u2026${body.slice(-suffixLen)}`;
}

/**
 * Format a latency string for display, normalising to lowercase.
 *
 * @example
 * formatLatency("42MS") // "42ms"
 */
export function formatLatency(latency: string): string {
  return latency.trim().toLowerCase();
}

/**
 * Return the display label for a postage status.
 *
 * @example
 * formatPostageStatus("settled") // "Settled"
 */
export function formatPostageStatus(status: ProofPostageStatus): string {
  return POSTAGE_STATUS_LABEL[status];
}

/**
 * Validate that a string looks like a hex-prefixed hash (`0x` + hex digits).
 * Used for lightweight client-side field validation in the editor.
 */
export function isValidMockHash(value: string): boolean {
  return /^0x[0-9a-fA-F]+$/.test(value.trim());
}

/**
 * Validate that a string looks like a UUID (8-4-4-4-12 hex groups).
 */
export function isValidDiagnosticId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value.trim());
}

/**
 * Build a one-line plain-text summary of a ProofRecord for logs or tooltips.
 *
 * @example
 * formatProofSummary(record)
 * // "msg=0xabc…1234 | pay=0xdef…5678 | settled | 42ms"
 */
export function formatProofSummary(
  record: Pick<ProofRecord, "messageHash" | "paymentHash" | "postageStatus" | "latency">,
): string {
  return [
    `msg=${truncateHash(record.messageHash)}`,
    `pay=${truncateHash(record.paymentHash)}`,
    POSTAGE_STATUS_LABEL[record.postageStatus],
    formatLatency(record.latency),
  ].join(" | ");
}

/**
 * Validate a full ProofRecord and return a list of field errors.
 * Returns an empty array when the record is valid.
 */
export function validateProofRecord(
  draft: Partial<ProofRecord>,
): Array<{ field: string; message: string }> {
  const errors: Array<{ field: string; message: string }> = [];

  if (!draft.messageHash || !isValidMockHash(draft.messageHash)) {
    errors.push({ field: "messageHash", message: "Must be a hex string starting with 0x." });
  }
  if (!draft.paymentHash || !isValidMockHash(draft.paymentHash)) {
    errors.push({ field: "paymentHash", message: "Must be a hex string starting with 0x." });
  }
  if (!draft.diagnosticId || !isValidDiagnosticId(draft.diagnosticId)) {
    errors.push({ field: "diagnosticId", message: "Must be a valid UUID (8-4-4-4-12)." });
  }
  if (!draft.contractAddress || draft.contractAddress.trim().length < 8) {
    errors.push({ field: "contractAddress", message: "Contract address is required." });
  }
  if (!draft.signature || draft.signature.trim().length === 0) {
    errors.push({ field: "signature", message: "Signature is required." });
  }
  if (!draft.latency || !/^\d+ms$/.test(draft.latency.trim().toLowerCase())) {
    errors.push({ field: "latency", message: 'Latency must be in the format "42ms".' });
  }
  if (!draft.postageStatus || !["pending", "settled", "refunded"].includes(draft.postageStatus)) {
    errors.push({ field: "postageStatus", message: "Must be pending, settled, or refunded." });
  }

  return errors;
}
