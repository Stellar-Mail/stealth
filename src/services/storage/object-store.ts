/**
 * R2-compatible encrypted object storage domain (#1937 / BETA-030).
 *
 * Encrypted envelope bodies and attachment chunks are large enough that KV and
 * Durable Objects are not suitable homes for them. This module defines the
 * domain contract for a content-addressed object store: deterministic object
 * naming that never leaks an original filename, and a staged-then-finalized
 * write path that verifies content length, SHA-256 commitment, media metadata,
 * and ownership *before* an object becomes readable. Staged objects that are
 * abandoned expire and are removed by the orphan cleanup sweep.
 *
 * The adapter (`r2-adapter.ts`) binds this contract to a Cloudflare R2 bucket;
 * the fake (`r2-fake.ts`) mirrors the same surface for local tests.
 */

import { createCommitment, verifyCommitment } from "@/services/crypto/commitment";

export const OBJECT_STORE_VERSION = "v1";

export const OBJECT_KIND_ENVELOPE_BODY = "envelope-body";
export const OBJECT_KIND_ATTACHMENT_CHUNK = "attachment-chunk";

export const OBJECT_KINDS = [OBJECT_KIND_ENVELOPE_BODY, OBJECT_KIND_ATTACHMENT_CHUNK] as const;

export type ObjectKind = (typeof OBJECT_KINDS)[number];

/** Object status lifecycle. Staged objects are not yet readable/committed. */
export type ObjectStatus = "staged" | "committed";

export interface ObjectStoreMetadata {
  version: string;
  kind: ObjectKind;
  messageId: string;
  ownerAddress: string;
  contentType: string;
  contentLength: number;
  contentCommitment: string;
  chunkIndex?: number;
  totalChunks?: number;
  status: ObjectStatus;
  createdAt: string;
  expiresAt?: string;
}

export interface StageObjectInput {
  kind: ObjectKind;
  messageId: string;
  ownerAddress: string;
  contentType: string;
  contentLength: number;
  contentCommitment: string;
  bytes: Uint8Array | ArrayBuffer;
  chunkIndex?: number;
  totalChunks?: number;
  /** Time-to-live for the staged object. Defaults to {@link DEFAULT_STAGED_TTL_MS}. */
  ttlMs?: number;
  /** Clock override for deterministic expiry in tests. */
  now?: () => Date;
}

export interface FinalizeObjectInput {
  /** Key returned by {@link ObjectStoreAdapter.stage}. */
  stagedKey: string;
  /** The actor finalizing must own the staged object. */
  ownerAddress: string;
  expectedContentLength: number;
  expectedCommitment: string;
  /** When supplied, the staged media metadata must match exactly. */
  expectedContentType?: string;
  now?: () => Date;
}

export interface StoredObject {
  key: string;
  bytes: Uint8Array;
  metadata: ObjectStoreMetadata;
}

export interface ObjectStoreAdapter {
  stage(input: StageObjectInput): Promise<{ stagedKey: string }>;
  finalize(input: FinalizeObjectInput): Promise<{ key: string; metadata: ObjectStoreMetadata }>;
  get(key: string, options?: { ownerAddress?: string }): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
  cleanupExpired(now?: Date): Promise<number>;
}

/** Default lifetime of a staged (not yet finalized) object. */
export const DEFAULT_STAGED_TTL_MS = 24 * 60 * 60 * 1000;

/** Staging prefix; everything under it is unreferenced until finalized. */
export const STAGING_PREFIX = "staged/";
/** Deterministic namespace for committed envelope bodies. */
export const ENVELOPE_BODY_PREFIX = "envelopes/";
/** Deterministic namespace for committed attachment chunks. */
export const ATTACHMENT_CHUNK_PREFIX = "attachments/";

export type ObjectStoreErrorCode =
  | "object_store_integrity_error"
  | "object_store_not_found"
  | "object_store_ownership_error"
  | "object_store_malformed_metadata"
  | "object_store_conflict";

export class ObjectStoreError extends Error {
  readonly code: ObjectStoreErrorCode;

  constructor(code: ObjectStoreErrorCode, message: string) {
    super(message);
    this.name = "ObjectStoreError";
    this.code = code;
  }
}

const STELLAR_ADDRESS_RE = /^G[A-Z2-7]{55}$/;
const HEX64_RE = /^[a-f0-9]{64}$/;

export function isStellarAddress(value: string): boolean {
  return STELLAR_ADDRESS_RE.test(value);
}

export function isHex64(value: string): boolean {
  return HEX64_RE.test(value);
}

/**
 * Extracts the raw hex digest from a versioned commitment string
 * (`v1:sha256:hex:<digest>`). Returns `null` when the commitment does not
 * parse. Used to derive content-addressed keys without ever exposing a
 * filename.
 */
export function commitmentDigest(commitment: string): string | null {
  const parts = commitment.split(":");
  if (parts.length !== 4) return null;
  if (parts[0] !== "v1" || parts[1] !== "sha256" || parts[2] !== "hex") return null;
  if (!HEX64_RE.test(parts[3])) return null;
  return parts[3];
}

/**
 * Deterministic content-addressed key for an envelope body. The key is derived
 * purely from the immutable message id and the SHA-256 commitment digest, so it
 * is reproducible and never contains a sensitive filename or plaintext.
 */
export function envelopeBodyKey(messageId: string, contentCommitment: string): string {
  const digest = commitmentDigest(contentCommitment);
  if (!digest) {
    throw new ObjectStoreError(
      "object_store_malformed_metadata",
      "Cannot derive an envelope body key from a malformed commitment",
    );
  }
  return `${ENVELOPE_BODY_PREFIX}${messageId}/${digest}`;
}

/**
 * Deterministic content-addressed key for an attachment chunk. The attachment
 * index is the only ordinal; the chunk content hash keeps the key unique per
 * distinct chunk without leaking the original filename.
 */
export function attachmentChunkKey(
  messageId: string,
  contentCommitment: string,
  chunkIndex: number,
): string {
  const digest = commitmentDigest(contentCommitment);
  if (!digest) {
    throw new ObjectStoreError(
      "object_store_malformed_metadata",
      "Cannot derive an attachment chunk key from a malformed commitment",
    );
  }
  return `${ATTACHMENT_CHUNK_PREFIX}${messageId}/${digest}/${chunkIndex}`;
}

/**
 * Validates the domain invariants of an object before it is staged. Ownership
 * is required so an object can never be finalized or read by an actor that does
 * not own it; media metadata is required so every object is served with a known
 * content type.
 */
export function validateStageInput(input: StageObjectInput): void {
  if (!OBJECT_KINDS.includes(input.kind)) {
    throw new ObjectStoreError("object_store_malformed_metadata", "Unsupported object kind");
  }
  if (!input.messageId || !isHex64(input.messageId)) {
    throw new ObjectStoreError(
      "object_store_malformed_metadata",
      "messageId must be a 64-character lowercase hex string",
    );
  }
  if (!input.ownerAddress || !isStellarAddress(input.ownerAddress)) {
    throw new ObjectStoreError(
      "object_store_ownership_error",
      "ownerAddress must be a valid Stellar G-address",
    );
  }
  if (!input.contentType || input.contentType.length > 128) {
    throw new ObjectStoreError(
      "object_store_malformed_metadata",
      "contentType must be a non-empty string of at most 128 characters",
    );
  }
  if (!Number.isSafeInteger(input.contentLength) || input.contentLength < 0) {
    throw new ObjectStoreError(
      "object_store_malformed_metadata",
      "contentLength must be a non-negative safe integer",
    );
  }
  if (!commitmentDigest(input.contentCommitment)) {
    throw new ObjectStoreError(
      "object_store_malformed_metadata",
      "contentCommitment must be a v1:sha256:hex:<digest> commitment",
    );
  }
  if (input.kind === OBJECT_KIND_ATTACHMENT_CHUNK) {
    if (!Number.isSafeInteger(input.chunkIndex) || (input.chunkIndex as number) < 0) {
      throw new ObjectStoreError(
        "object_store_malformed_metadata",
        "attachment chunks require a non-negative chunkIndex",
      );
    }
  }
}

export interface IntegrityCheckInput {
  bytes: Uint8Array;
  contentLength: number;
  contentCommitment: string;
}

/**
 * Verifies that downloaded bytes match the stored content length and SHA-256
 * commitment. Throws a stable {@link ObjectStoreError} on any mismatch so
 * corruption can never be served to a caller.
 */
export async function verifyObjectIntegrity(input: IntegrityCheckInput): Promise<void> {
  if (input.bytes.length !== input.contentLength) {
    throw new ObjectStoreError(
      "object_store_integrity_error",
      `Object length mismatch: expected ${input.contentLength} bytes, received ${input.bytes.length}`,
    );
  }
  try {
    await verifyCommitment(input.contentCommitment, input.bytes);
  } catch {
    throw new ObjectStoreError(
      "object_store_integrity_error",
      "Object content failed the SHA-256 commitment check",
    );
  }
}

/** Creates a fresh SHA-256 commitment for the given bytes. */
export async function createObjectCommitment(bytes: Uint8Array): Promise<string> {
  return createCommitment(bytes);
}

/** Serializes object metadata into the string map stored on an R2 object. */
export function serializeMetadata(metadata: ObjectStoreMetadata): Record<string, string> {
  return {
    version: metadata.version,
    kind: metadata.kind,
    messageId: metadata.messageId,
    ownerAddress: metadata.ownerAddress,
    contentType: metadata.contentType,
    contentLength: String(metadata.contentLength),
    contentCommitment: metadata.contentCommitment,
    ...(metadata.chunkIndex !== undefined ? { chunkIndex: String(metadata.chunkIndex) } : {}),
    ...(metadata.totalChunks !== undefined ? { totalChunks: String(metadata.totalChunks) } : {}),
    status: metadata.status,
    createdAt: metadata.createdAt,
    ...(metadata.expiresAt ? { expiresAt: metadata.expiresAt } : {}),
  };
}

/**
 * Parses object metadata from an R2 custom-metadata string map. Rejects missing
 * or malformed fields so a tampered object fails closed rather than being
 * treated as valid.
 */
export function deserializeMetadata(raw: Record<string, string>): ObjectStoreMetadata {
  const contentLength = Number(raw.contentLength);
  if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
    throw new ObjectStoreError("object_store_malformed_metadata", "Malformed contentLength");
  }

  const chunkIndex = raw.chunkIndex !== undefined ? Number(raw.chunkIndex) : undefined;
  if (chunkIndex !== undefined && (!Number.isSafeInteger(chunkIndex) || chunkIndex < 0)) {
    throw new ObjectStoreError("object_store_malformed_metadata", "Malformed chunkIndex");
  }
  const totalChunks = raw.totalChunks !== undefined ? Number(raw.totalChunks) : undefined;
  if (totalChunks !== undefined && (!Number.isSafeInteger(totalChunks) || totalChunks < 0)) {
    throw new ObjectStoreError("object_store_malformed_metadata", "Malformed totalChunks");
  }

  return {
    version: raw.version ?? "",
    kind: (raw.kind as ObjectKind) ?? "",
    messageId: raw.messageId ?? "",
    ownerAddress: raw.ownerAddress ?? "",
    contentType: raw.contentType ?? "",
    contentLength,
    contentCommitment: raw.contentCommitment ?? "",
    ...(chunkIndex !== undefined ? { chunkIndex } : {}),
    ...(totalChunks !== undefined ? { totalChunks } : {}),
    status: (raw.status as ObjectStatus) ?? "staged",
    createdAt: raw.createdAt ?? "",
    ...(raw.expiresAt ? { expiresAt: raw.expiresAt } : {}),
  };
}

/** Guards metadata fields that must be well-formed before the object is trusted. */
export function assertValidMetadata(metadata: ObjectStoreMetadata): void {
  if (!OBJECT_KINDS.includes(metadata.kind)) {
    throw new ObjectStoreError("object_store_malformed_metadata", "Unsupported object kind");
  }
  if (!isHex64(metadata.messageId)) {
    throw new ObjectStoreError("object_store_malformed_metadata", "Malformed messageId");
  }
  if (!isStellarAddress(metadata.ownerAddress)) {
    throw new ObjectStoreError("object_store_ownership_error", "Malformed ownerAddress");
  }
  if (!metadata.contentType || metadata.contentType.length > 128) {
    throw new ObjectStoreError("object_store_malformed_metadata", "Malformed contentType");
  }
  if (!Number.isSafeInteger(metadata.contentLength) || metadata.contentLength < 0) {
    throw new ObjectStoreError("object_store_malformed_metadata", "Malformed contentLength");
  }
  if (!commitmentDigest(metadata.contentCommitment)) {
    throw new ObjectStoreError("object_store_malformed_metadata", "Malformed contentCommitment");
  }
  if (metadata.status !== "staged" && metadata.status !== "committed") {
    throw new ObjectStoreError("object_store_malformed_metadata", "Malformed status");
  }
}

/** Returns `true` when a staged object's expiry timestamp is in the past. */
export function isExpired(metadata: ObjectStoreMetadata, now: Date): boolean {
  if (!metadata.expiresAt) return false;
  const expires = Date.parse(metadata.expiresAt);
  return Number.isFinite(expires) && expires <= now.getTime();
}
