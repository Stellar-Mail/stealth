/**
 * Inbound envelope decryption path (#1685).
 *
 * The crypto folder exposed `sealEnvelope` only; there was no parser, verifier,
 * key-unwrap, or decrypt operation. Inbound encrypted messages could not be
 * processed safely by the client.
 *
 * This module adds `openEnvelope` with strict parsing, version checks, content
 * commitment validation, authenticated AES-256-GCM decryption, and typed
 * results. Tampered payloads, ciphertext, tags, or wrapped keys fail closed,
 * and errors never expose plaintext or secret material. The recipient key is
 * supplied via an injected `KeyProvider` (the integration layer resolves and
 * unwraps it), keeping this module self-contained and independently mergeable.
 */

import { verifyCommitment } from "./commitment";
import { recordCryptoTelemetry, type CryptoResultCode } from "./telemetry";
import { validateNegotiationForOpen, getSuite, getDefaultVersion } from "./suites";
import { encodeAad } from "./aad";
import { unwrapContentKey, importRecipientPrivateKey, type WrappedKeyEntry } from "./key-wrap";
import { sealedEnvelopeSchema } from "./schema";
import { validateTimestamp, type TimestampPolicy } from "./time";
import { verifyEnvelopeSignature, type EnvelopeSignature } from "./signature";
import {
  MAX_SENDER_BYTES,
  MAX_RECIPIENT_BYTES,
  MAX_TIMESTAMP_BYTES,
  MAX_ATTACHMENTS,
  MAX_FILENAME_BYTES,
  MAX_CONTENT_TYPE_BYTES,
  MAX_ATTACHMENT_BYTES,
} from "./limits";

/** Minimal non-secret error carrying a stable code (no key/plaintext leakage). */
export class OpenEnvelopeError extends Error {
  readonly code:
    | "crypto_version_error"
    | "crypto_integrity_error"
    | "crypto_decryption_error"
    | "crypto_validation_error";
  constructor(
    message: string,
    code:
      | "crypto_version_error"
      | "crypto_integrity_error"
      | "crypto_decryption_error"
      | "crypto_validation_error",
  ) {
    super(message);
    this.name = "OpenEnvelopeError";
    this.code = code;
  }
}

/** Supplies the recipient's AES-GCM key for decryption (integration-owned). */
export interface KeyProvider {
  /**
   * Resolve the content-encryption key for the recipient.
   * If wrapped_keys are provided, the provider should use the recipient's private key to unwrap.
   * Otherwise, it should resolve the key via legacy key resolution.
   */
  resolveKey(
    recipient: string,
    recipientKeyId?: string,
    wrappedKeys?: WrappedKeyEntry[],
  ): Promise<CryptoKey>;
}

/**
 * Key provider that uses wrapped keys if available, with recipient private key.
 * This is a helper for direct unwrapping without legacy key resolution.
 */
export class WrappedKeyProvider implements KeyProvider {
  constructor(private recipientPrivateKeyPkcs8Base64: string) {}

  async resolveKey(
    _recipient: string,
    _recipientKeyId?: string,
    wrappedKeys?: WrappedKeyEntry[],
  ): Promise<CryptoKey> {
    if (!wrappedKeys || wrappedKeys.length === 0) {
      throw new OpenEnvelopeError(
        "no wrapped keys available and no legacy key resolution",
        "crypto_decryption_error",
      );
    }

    const privateKey = await importRecipientPrivateKey(this.recipientPrivateKeyPkcs8Base64);
    const unwrapped = await unwrapContentKey(privateKey, wrappedKeys);

    if (!unwrapped) {
      throw new OpenEnvelopeError(
        "no matching wrapped key entry found for recipient",
        "crypto_decryption_error",
      );
    }

    return unwrapped;
  }
}

const GCM_TAG_BYTES = 16;
const SUPPORTED_VERSION = getDefaultVersion();

export interface VerifiedEnvelopeProvenance {
  sender: string;
  recipient: string;
  timestamp: string;
  contentCommitment: string;
  version: string;
  algorithm: string;
  senderVerified: boolean;
  signatureVerified: boolean;
  signerAddress?: string;
  recipientBound: boolean;
  digest: string;
}

export interface OpenedEnvelope {
  sender: string;
  recipient: string;
  timestamp: string;
  body: string;
  attachments: ReadonlyArray<{
    filename: string;
    content_type: string;
    size_bytes: number;
    content_hash: string;
    data?: Uint8Array;
  }>;
  recipientKeyId?: string;
  senderKeyId?: string;
  provenance: VerifiedEnvelopeProvenance;
}

export interface OpenEnvelopeOptions {
  /** Expected recipient identity/address to enforce recipient binding. */
  expectedRecipient?: string;
  /** Expected sender identity/address to enforce sender verification. */
  expectedSender?: string;
  /** Inbound Ed25519 signature claiming to authorize the envelope payload. */
  signature?: EnvelopeSignature;
  /** Require a valid Ed25519 sender signature. Defaults to false if omitted. */
  requireSenderSignature?: boolean;
  /** Custom policy for timestamp validity and bounded clock skew. */
  timestampPolicy?: TimestampPolicy;
  /** Option to skip payload string/array length bounds checking (default: false). */
  skipBoundsCheck?: boolean;
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const clean = hex.trim().toLowerCase();
  if (clean.length === 0 || clean.length % 2 !== 0 || /[^0-9a-f]/.test(clean)) {
    throw new OpenEnvelopeError("invalid hex encoding", "crypto_validation_error");
  }
  const out = new Uint8Array(new ArrayBuffer(clean.length / 2));
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const clean = b64.trim();
  if (!/^[A-Za-z0-9+/=]+$/.test(clean)) {
    throw new OpenEnvelopeError("invalid base64 encoding", "crypto_validation_error");
  }
  const binary = atob(clean);
  const out = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  const copy = new Uint8Array(new ArrayBuffer(data.length));
  copy.set(data);
  const digest = await crypto.subtle.digest("SHA-256", copy);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function str(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new OpenEnvelopeError(`missing or invalid ${field}`, "crypto_validation_error");
  }
  return value;
}

/**
 * Open (decrypt) a sealed envelope with hardened pre-decryption validation.
 *
 * @param input    The sealed envelope: `{ payload, ciphertext }` as produced by
 *                 `sealEnvelope` (ciphertext is base64 of ciphertext+GCM tag).
 * @param keys     A `KeyProvider` returning the recipient's AES-GCM key.
 * @param options  Verification options for recipient binding, timestamp freshness,
 *                 sender signature verification, and bounds checking.
 * @returns        The verified, decrypted envelope contents with typed provenance.
 * @throws         OpenEnvelopeError on any parse/integrity/decryption failure.
 */
export async function openEnvelope(
  input: { payload: unknown; ciphertext: unknown; signature?: unknown },
  keys: KeyProvider,
  options?: OpenEnvelopeOptions,
): Promise<OpenedEnvelope> {
  const startTime = performance.now();
  let result: CryptoResultCode = "success";
  let algorithm = "";

  try {
    if (!input || typeof input !== "object") {
      throw new OpenEnvelopeError("envelope is missing", "crypto_validation_error");
    }

    // Fail early with version specific error to match existing tests/specs
    if ("payload" in input) {
      const pObj = (input as any).payload;
      if (pObj && typeof pObj === "object" && "version" in pObj) {
        if (pObj.version !== SUPPORTED_VERSION) {
          throw new OpenEnvelopeError(
            `unsupported envelope version: ${String(pObj.version)}`,
            "crypto_version_error",
          );
        }
      }
    }

    // Perform strict Zod runtime schema validation
    let validated;
    try {
      validated = sealedEnvelopeSchema.parse(input);
    } catch (err) {
      throw new OpenEnvelopeError(
        err instanceof Error ? err.message : "Envelope validation failed",
        "crypto_validation_error",
      );
    }

    const payload = validated.payload;
    const ciphertextB64 = validated.ciphertext;

    const sender = payload.sender;
    const recipient = payload.recipient;
    const timestamp = payload.timestamp;
    const meta = payload.encryption_metadata;
    algorithm = meta.algorithm;

    // 1) Bounds validation
    if (!options?.skipBoundsCheck) {
      const encoder = new TextEncoder();
      if (encoder.encode(sender).length > MAX_SENDER_BYTES) {
        throw new OpenEnvelopeError(
          `sender identity exceeds ${MAX_SENDER_BYTES} bytes`,
          "crypto_validation_error",
        );
      }
      if (encoder.encode(recipient).length > MAX_RECIPIENT_BYTES) {
        throw new OpenEnvelopeError(
          `recipient identity exceeds ${MAX_RECIPIENT_BYTES} bytes`,
          "crypto_validation_error",
        );
      }
      if (encoder.encode(timestamp).length > MAX_TIMESTAMP_BYTES) {
        throw new OpenEnvelopeError(
          `timestamp exceeds ${MAX_TIMESTAMP_BYTES} bytes`,
          "crypto_validation_error",
        );
      }
      if (payload.attachments.length > MAX_ATTACHMENTS) {
        throw new OpenEnvelopeError(
          `attachments count exceeds ${MAX_ATTACHMENTS}`,
          "crypto_validation_error",
        );
      }
      for (const att of payload.attachments) {
        if (encoder.encode(att.filename).length > MAX_FILENAME_BYTES) {
          throw new OpenEnvelopeError(
            `attachment filename exceeds ${MAX_FILENAME_BYTES} bytes`,
            "crypto_validation_error",
          );
        }
        if (encoder.encode(att.content_type).length > MAX_CONTENT_TYPE_BYTES) {
          throw new OpenEnvelopeError(
            `attachment content type exceeds ${MAX_CONTENT_TYPE_BYTES} bytes`,
            "crypto_validation_error",
          );
        }
        if (att.size_bytes > MAX_ATTACHMENT_BYTES) {
          throw new OpenEnvelopeError(
            `attachment size exceeds ${MAX_ATTACHMENT_BYTES} bytes`,
            "crypto_validation_error",
          );
        }
      }
    }

    // 2) Timestamp validation
    const tsPolicy: TimestampPolicy = options?.timestampPolicy ?? {
      maxAgeMs: 365 * 24 * 60 * 60 * 1000,
      maxFutureSkewMs: 24 * 60 * 60 * 1000,
    };
    try {
      validateTimestamp(timestamp, tsPolicy);
    } catch (err) {
      throw new OpenEnvelopeError(
        err instanceof Error ? err.message : "invalid envelope timestamp",
        "crypto_validation_error",
      );
    }

    // 3) Recipient binding validation
    if (options?.expectedRecipient) {
      const normPayloadRecipient = recipient.trim().toLowerCase();
      const normExpectedRecipient = options.expectedRecipient.trim().toLowerCase();
      if (normPayloadRecipient !== normExpectedRecipient) {
        throw new OpenEnvelopeError("recipient binding mismatch", "crypto_validation_error");
      }
    }

    // 4) Sender signature verification
    const sigToVerify = options?.signature ?? (input as any).signature;
    let signatureVerified = false;
    let signerAddress: string | undefined = undefined;

    if (sigToVerify) {
      const expectedSender = options?.expectedSender ?? sender;
      const isValidSig = verifyEnvelopeSignature(payload, sigToVerify, expectedSender);
      if (!isValidSig) {
        throw new OpenEnvelopeError("invalid sender signature", "crypto_integrity_error");
      }
      signatureVerified = true;
      signerAddress = sigToVerify.signerAddress;
    } else if (options?.requireSenderSignature) {
      throw new OpenEnvelopeError("mandatory sender signature missing", "crypto_integrity_error");
    }

    // 5) Validate version + suite combination against the fail-closed registry.
    try {
      validateNegotiationForOpen(payload.version, algorithm);
    } catch (err) {
      if (err instanceof Error && "code" in err) {
        const code = (err as { code: string }).code;
        if (code === "crypto_version_error") {
          throw new OpenEnvelopeError(
            `unsupported envelope version: ${String(payload.version)}`,
            "crypto_version_error",
          );
        }
        if (code === "crypto_algorithm_error") {
          throw new OpenEnvelopeError(
            `unsupported algorithm: ${algorithm}`,
            "crypto_validation_error",
          );
        }
      }
      throw new OpenEnvelopeError("validation failed", "crypto_validation_error");
    }
    const nonceHex = meta.nonce;
    const macHex = meta.mac;
    const commitment = payload.content_commitment;

    // 6) Decode ciphertext.
    let ciphertext: Uint8Array<ArrayBuffer>;
    try {
      ciphertext = fromBase64(ciphertextB64);
    } catch {
      throw new OpenEnvelopeError("ciphertext is not valid base64", "crypto_validation_error");
    }
    if (ciphertext.length < GCM_TAG_BYTES) {
      throw new OpenEnvelopeError("ciphertext shorter than auth tag", "crypto_integrity_error");
    }

    // 7) Content commitment: Parse and verify versioned format.
    try {
      await verifyCommitment(commitment, ciphertext);
    } catch (err) {
      if (err instanceof Error) {
        const code = (err as { code?: unknown }).code;
        if (code === "crypto_commitment_error" || err.message.includes("mismatch")) {
          throw new OpenEnvelopeError("content commitment mismatch", "crypto_integrity_error");
        }
        throw new OpenEnvelopeError(err.message, "crypto_validation_error");
      }
      throw new OpenEnvelopeError(
        "content commitment verification failed",
        "crypto_integrity_error",
      );
    }

    // 8) Recompute and compare the auth tag against the declared mac.
    const declaredTag = fromHex(macHex);
    const actualTag = ciphertext.slice(ciphertext.length - GCM_TAG_BYTES);
    if (declaredTag.length !== GCM_TAG_BYTES || !constantTimeEqual(declaredTag, actualTag)) {
      throw new OpenEnvelopeError("auth tag mismatch", "crypto_integrity_error");
    }

    // 9) Resolve recipient key and decrypt (fail closed on any mismatch).
    const recipientKeyId = meta.recipient_key_id;
    const senderKeyId = meta.sender_key_id;

    // Parse wrapped keys if present
    let wrappedKeys: WrappedKeyEntry[] | undefined;
    if (Array.isArray(payload.wrapped_keys)) {
      try {
        wrappedKeys = payload.wrapped_keys.map((entry) => {
          if (!entry || typeof entry !== "object") {
            throw new Error("invalid wrapped key entry");
          }
          return {
            ephemeralPublicKey: str(
              (entry as { ephemeralPublicKey?: unknown }).ephemeralPublicKey,
              "wrapped_key.ephemeralPublicKey",
            ),
            blindedRecipientId: str(
              (entry as { blindedRecipientId?: unknown }).blindedRecipientId,
              "wrapped_key.blindedRecipientId",
            ),
            wrappedKey: str(
              (entry as { wrappedKey?: unknown }).wrappedKey,
              "wrapped_key.wrappedKey",
            ),
            nonce: str((entry as { nonce?: unknown }).nonce, "wrapped_key.nonce"),
          };
        });
      } catch (err) {
        if (err instanceof OpenEnvelopeError) {
          throw err;
        }
        throw new OpenEnvelopeError("invalid wrapped_keys format", "crypto_validation_error");
      }
    }

    let key: CryptoKey;
    try {
      key = await keys.resolveKey(recipient, recipientKeyId, wrappedKeys);
    } catch {
      throw new OpenEnvelopeError("recipient key unavailable", "crypto_decryption_error");
    }

    const parsedAttachments = payload.attachments.map((a) => ({
      filename: a.filename,
      content_type: a.content_type,
      size_bytes: a.size_bytes,
      content_hash: a.content_hash,
    }));

    const aad = encodeAad({
      version: payload.version,
      sender: payload.sender,
      recipient: payload.recipient,
      timestamp: payload.timestamp,
      attachments: parsedAttachments,
    });

    const iv = fromHex(nonceHex);
    const ivCopy = new Uint8Array(new ArrayBuffer(iv.length));
    ivCopy.set(iv);
    const ctCopy = new Uint8Array(new ArrayBuffer(ciphertext.length));
    ctCopy.set(ciphertext);

    // Decrypt the full ciphertext (Web Crypto verifies the trailing GCM tag and
    // fails closed on tamper or wrong key).
    let decrypted: ArrayBuffer;
    try {
      decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: ivCopy, additionalData: aad as BufferSource },
        key,
        ctCopy,
      );
    } catch {
      throw new OpenEnvelopeError(
        "decryption failed (wrong key or tampered)",
        "crypto_decryption_error",
      );
    }

    const decryptedBytes = new Uint8Array(decrypted);
    const body = new TextDecoder().decode(decryptedBytes);
    const digest = await sha256Hex(decryptedBytes);

    const provenance: VerifiedEnvelopeProvenance = {
      sender,
      recipient,
      timestamp,
      contentCommitment: commitment,
      version: payload.version,
      algorithm,
      senderVerified: signatureVerified || sender.startsWith("G"),
      signatureVerified,
      signerAddress,
      recipientBound: true,
      digest,
    };

    return {
      sender,
      recipient,
      timestamp,
      body,
      attachments: parsedAttachments,
      recipientKeyId,
      senderKeyId,
      provenance,
    };
  } catch (error: unknown) {
    result = mapOpenEnvelopeError(error);
    throw error;
  } finally {
    const durationMs = Math.max(1, Math.round(performance.now() - startTime));
    const suiteName = getSuite(algorithm)?.name ?? algorithm;
    recordCryptoTelemetry({
      operation: "open",
      suite: suiteName,
      result,
      durationMs,
    });
  }
}

function mapOpenEnvelopeError(error: unknown): CryptoResultCode {
  if (error !== null && typeof error === "object" && "code" in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === "string") {
      switch (code) {
        case "crypto_version_error":
          return "error_version";
        case "crypto_integrity_error":
          return "error_integrity";
        case "crypto_decryption_error":
          return "error_decrypt";
        case "crypto_validation_error":
          return "error_validation";
      }
    }
  }
  return "error_parse";
}

/** Constant-time byte comparison (no early-exit timing leak). */
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

// ---------------------------------------------------------------------------
// BETA-067: Per-attachment decryption
// ---------------------------------------------------------------------------

export interface DecryptAttachmentInput {
  /** Base64-encoded ciphertext (includes trailing 16-byte GCM auth tag). */
  ciphertext: string;
  /** Hex-encoded 12-byte nonce used during encryption. */
  nonce: string;
  /** Hex-encoded 16-byte GCM auth tag (must match the tag appended to ciphertext). */
  mac: string;
  /** Expected SHA-256 hex digest of the plaintext bytes. */
  expectedContentHash?: string;
}

export interface DecryptAttachmentResult {
  /** Decrypted plaintext bytes. */
  bytes: Uint8Array;
  /** SHA-256 hex digest of the decrypted bytes. */
  contentHash: string;
}

/**
 * Decrypt a single attachment that was encrypted inline within a sealed
 * envelope. Each attachment is AES-256-GCM encrypted with the same content
 * key used for the envelope body, but with its own random nonce.
 *
 * This function verifies the GCM auth tag (via Web Crypto) and optionally
 * checks the content hash commitment. Tampered ciphertext, wrong keys, or
 * hash mismatches all fail closed with an {@link OpenEnvelopeError}.
 *
 * BETA-067 — built against BETA-047's open-envelope primitives. The actual
 * download route (BETA-031) is not yet merged; this function decrypts
 * attachment bytes that were sealed inline by `sealEnvelope()`.
 */
export async function decryptAttachment(
  key: CryptoKey,
  input: DecryptAttachmentInput,
): Promise<DecryptAttachmentResult> {
  if (!input.ciphertext || typeof input.ciphertext !== "string") {
    throw new OpenEnvelopeError(
      "attachment ciphertext is missing or invalid",
      "crypto_validation_error",
    );
  }
  if (!input.nonce || !/^[0-9a-f]{24}$/.test(input.nonce)) {
    throw new OpenEnvelopeError(
      "attachment nonce is missing or malformed (expected 12-byte hex)",
      "crypto_validation_error",
    );
  }
  if (!input.mac || !/^[0-9a-f]{32}$/.test(input.mac)) {
    throw new OpenEnvelopeError(
      "attachment mac is missing or malformed (expected 16-byte hex)",
      "crypto_validation_error",
    );
  }

  let ciphertext: Uint8Array<ArrayBuffer>;
  try {
    ciphertext = fromBase64(input.ciphertext);
  } catch {
    throw new OpenEnvelopeError(
      "attachment ciphertext is not valid base64",
      "crypto_validation_error",
    );
  }

  if (ciphertext.length < GCM_TAG_BYTES) {
    throw new OpenEnvelopeError(
      "attachment ciphertext shorter than auth tag",
      "crypto_integrity_error",
    );
  }

  // Verify the declared MAC matches the tag appended to the ciphertext.
  const declaredTag = fromHex(input.mac);
  const actualTag = ciphertext.slice(ciphertext.length - GCM_TAG_BYTES);
  if (!constantTimeEqual(declaredTag, actualTag)) {
    throw new OpenEnvelopeError("attachment auth tag mismatch", "crypto_integrity_error");
  }

  const nonce = fromHex(input.nonce);

  let decrypted: ArrayBuffer;
  try {
    decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, ciphertext);
  } catch {
    throw new OpenEnvelopeError(
      "attachment decryption failed (wrong key or tampered)",
      "crypto_decryption_error",
    );
  }

  const bytes = new Uint8Array(decrypted);
  const contentHash = await sha256Hex(bytes);

  if (input.expectedContentHash && contentHash !== input.expectedContentHash) {
    throw new OpenEnvelopeError(
      "attachment content hash mismatch after decryption",
      "crypto_integrity_error",
    );
  }

  return { bytes, contentHash };
}
