/**
 * ProofRecord types for demo proof metadata editing in the admin dashboard.
 *
 * All data is fake, deterministic, and safe for public repository review.
 */

/** Status of postage attached to a proof record. */
export type ProofPostageStatus = "pending" | "settled" | "refunded";

/** Signature scheme used for the proof. */
export type ProofSignatureScheme = "Ed25519" | "ECDSA";

/** A single editable demo proof record representing anchored message metadata. */
export interface ProofRecord {
  /** Unique identifier for this proof record. */
  id: string;
  /** Hex-encoded SHA-256 hash of the message payload. */
  messageHash: string;
  /** Hex-encoded hash of the on-chain payment transaction. */
  paymentHash: string;
  /** Soroban contract address that recorded this proof. */
  contractAddress: string;
  /** Unique diagnostic trace identifier (UUID format). */
  diagnosticId: string;
  /** Human-readable relay round-trip latency (e.g. "42ms"). */
  latency: string;
  /** Encoded signature with scheme prefix (e.g. "Ed25519 [0xabc...]"). */
  signature: string;
  /** Postage settlement state. */
  postageStatus: ProofPostageStatus;
}

/** Fields that can be modified when editing a ProofRecord in the admin dashboard. */
export type ProofRecordDraft = Omit<ProofRecord, "id">;

/** Validation error on a specific ProofRecord field. */
export interface ProofRecordFieldError {
  field: keyof ProofRecordDraft;
  message: string;
}

/** Result of validating a ProofRecordDraft. */
export interface ProofRecordValidationResult {
  valid: boolean;
  errors: ProofRecordFieldError[];
}
