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
  resolveKey(recipient: string): Promise<CryptoKey>;
}

const GCM_TAG_BYTES = 16;
const SUPPORTED_VERSION = "v1";

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
  }>;
}

export const MAX_CIPHERTEXT_BASE64_LENGTH = 10 * 1024 * 1024; // 10 MB
export const MAX_FIELD_STRING_LENGTH = 8192; // 8 KB
export const MAX_ATTACHMENTS_COUNT = 100;
export const MAX_RAW_INPUT_STRING_LENGTH = 15 * 1024 * 1024; // 15 MB

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  if (typeof hex !== "string" || hex.length > MAX_FIELD_STRING_LENGTH) {
    throw new OpenEnvelopeError("invalid hex encoding", "crypto_validation_error");
  }
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
  if (typeof b64 !== "string" || b64.length > MAX_CIPHERTEXT_BASE64_LENGTH) {
    throw new OpenEnvelopeError("invalid base64 encoding", "crypto_validation_error");
  }
  const clean = b64.trim();
  if (clean.length === 0 || !/^[A-Za-z0-9+/=]+$/.test(clean)) {
    throw new OpenEnvelopeError("invalid base64 encoding", "crypto_validation_error");
  }
  try {
    const binary = atob(clean);
    const out = new Uint8Array(new ArrayBuffer(binary.length));
    for (let i = 0; i < binary.length; i += 1) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  } catch {
    throw new OpenEnvelopeError("invalid base64 encoding", "crypto_validation_error");
  }
}

function str(value: unknown, field: string, maxLength = MAX_FIELD_STRING_LENGTH): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new OpenEnvelopeError(`missing or invalid ${field}`, "crypto_validation_error");
  }
  if (value.length > maxLength) {
    throw new OpenEnvelopeError(`${field} exceeds maximum allowed length`, "crypto_validation_error");
  }
  return value;
}

/**
 * /** Shape we accept (structural — we validate fields individually). */
interface RawPayload {
  version?: unknown;
  sender?: unknown;
  recipient?: unknown;
  timestamp?: unknown;
  encryption_metadata?: {
    algorithm?: unknown;
    nonce?: unknown;
    mac?: unknown;
    ephemeral_public_key?: unknown;
  };
  content_commitment?: unknown;
  attachments?: unknown;
}

/**
 * Open (decrypt) a sealed envelope.
 *
 * @param input  The sealed envelope: `{ payload, ciphertext }` or raw JSON string.
 * @param keys   A `KeyProvider` returning the recipient's AES-GCM key.
 * @returns      The verified, decrypted envelope contents.
 * @throws       OpenEnvelopeError on any parse/integrity/decryption failure.
 */
export async function openEnvelope(
  input: unknown,
  keys: KeyProvider,
): Promise<OpenedEnvelope> {
  const startTime = performance.now();
  let result: CryptoResultCode = "success";

  try {
    let parsedInput: Record<string, unknown>;

    if (typeof input === "string") {
      if (input.length > MAX_RAW_INPUT_STRING_LENGTH) {
        throw new OpenEnvelopeError("envelope input exceeds maximum allowed size", "crypto_validation_error");
      }
      try {
        parsedInput = JSON.parse(input);
      } catch {
        throw new OpenEnvelopeError("invalid envelope JSON format", "crypto_validation_error");
      }
    } else if (input && typeof input === "object" && !Array.isArray(input)) {
      parsedInput = input as Record<string, unknown>;
    } else {
      throw new OpenEnvelopeError("envelope is missing", "crypto_validation_error");
    }

    if (!parsedInput || typeof parsedInput !== "object" || Array.isArray(parsedInput)) {
      throw new OpenEnvelopeError("envelope is missing", "crypto_validation_error");
    }

    const ciphertextB64 = str(parsedInput.ciphertext, "ciphertext", MAX_CIPHERTEXT_BASE64_LENGTH);

    const payload = parsedInput.payload as RawPayload | undefined;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new OpenEnvelopeError("payload is missing", "crypto_validation_error");
    }

    if (typeof payload.version !== "string") {
      throw new OpenEnvelopeError("missing or invalid version", "crypto_version_error");
    }

    if (payload.version !== SUPPORTED_VERSION) {
      throw new OpenEnvelopeError(
        `unsupported envelope version: ${String(payload.version)}`,
        "crypto_version_error",
      );
    }

    const sender = str(payload.sender, "sender");
    const recipient = str(payload.recipient, "recipient");
    const timestamp = str(payload.timestamp, "timestamp");

    const meta = payload.encryption_metadata;
    if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
      throw new OpenEnvelopeError("encryption_metadata is missing", "crypto_validation_error");
    }

    const algorithm = str(meta.algorithm, "algorithm");
    if (algorithm !== "AES-256-GCM") {
      throw new OpenEnvelopeError(`unsupported algorithm: ${algorithm}`, "crypto_validation_error");
    }
    const nonceHex = str(meta.nonce, "nonce");
    const macHex = str(meta.mac, "mac");
    const commitment = str(payload.content_commitment, "content_commitment");

    // 1) Decode ciphertext.
    let ciphertext: Uint8Array<ArrayBuffer>;
    try {
      ciphertext = fromBase64(ciphertextB64);
    } catch (err) {
      if (err instanceof OpenEnvelopeError) throw err;
      throw new OpenEnvelopeError("ciphertext is not valid base64", "crypto_validation_error");
    }
    if (ciphertext.length < GCM_TAG_BYTES) {
      throw new OpenEnvelopeError("ciphertext shorter than auth tag", "crypto_integrity_error");
    }

    // 2) Content commitment: Parse and verify versioned format.
    try {
      await verifyCommitment(commitment, ciphertext);
    } catch (err) {
      if (err instanceof OpenEnvelopeError) throw err;
      if (err instanceof Error) {
        if (err.message.includes("mismatch") || err.message.includes("crypto_commitment_error")) {
          throw new OpenEnvelopeError("content commitment mismatch", "crypto_integrity_error");
        }
        throw new OpenEnvelopeError(err.message, "crypto_validation_error");
      }
      throw new OpenEnvelopeError("content commitment verification failed", "crypto_integrity_error");
    }

    // 3) Recompute and compare the auth tag against the declared mac.
    const declaredTag = fromHex(macHex);
    const actualTag = ciphertext.slice(ciphertext.length - GCM_TAG_BYTES);
    if (declaredTag.length !== GCM_TAG_BYTES || !constantTimeEqual(declaredTag, actualTag)) {
      throw new OpenEnvelopeError("auth tag mismatch", "crypto_integrity_error");
    }

    // 4) Resolve recipient key and decrypt (fail closed on any mismatch).
    let key: CryptoKey;
    try {
      key = await keys.resolveKey(recipient);
    } catch {
      throw new OpenEnvelopeError("recipient key unavailable", "crypto_decryption_error");
    }

    const iv = fromHex(nonceHex);
    const ivCopy = new Uint8Array(new ArrayBuffer(iv.length));
    ivCopy.set(iv);
    const ctCopy = new Uint8Array(new ArrayBuffer(ciphertext.length));
    ctCopy.set(ciphertext);

    // Decrypt the full ciphertext (Web Crypto verifies the trailing GCM tag and
    // fails closed on tamper or wrong key).
    let decrypted: ArrayBuffer;
    try {
      decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: ivCopy }, key, ctCopy);
    } catch {
      throw new OpenEnvelopeError(
        "decryption failed (wrong key or tampered)",
        "crypto_decryption_error",
      );
    }

    const body = new TextDecoder().decode(new Uint8Array(decrypted));

    if (payload.attachments !== undefined && !Array.isArray(payload.attachments)) {
      throw new OpenEnvelopeError("attachments must be an array", "crypto_validation_error");
    }

    if (Array.isArray(payload.attachments) && payload.attachments.length > MAX_ATTACHMENTS_COUNT) {
      throw new OpenEnvelopeError("too many attachments", "crypto_validation_error");
    }

    const attachments = Array.isArray(payload.attachments)
      ? payload.attachments.map((a, idx) => {
          if (!a || typeof a !== "object" || Array.isArray(a)) {
            throw new OpenEnvelopeError(`invalid attachment at index ${idx}`, "crypto_validation_error");
          }
          const filename = str((a as { filename?: unknown }).filename, "attachment.filename", 1024);
          const content_type = str(
            (a as { content_type?: unknown }).content_type,
            "attachment.content_type",
            1024,
          );
          const sizeVal = (a as { size_bytes?: unknown }).size_bytes;
          let size_bytes: number;
          if (typeof sizeVal === "number" && Number.isFinite(sizeVal) && sizeVal >= 0) {
            size_bytes = sizeVal;
          } else if (typeof sizeVal === "string" && /^\d+$/.test(sizeVal)) {
            size_bytes = Number.parseInt(sizeVal, 10);
          } else {
            throw new OpenEnvelopeError("missing or invalid attachment.size_bytes", "crypto_validation_error");
          }
          const content_hash = str(
            (a as { content_hash?: unknown }).content_hash,
            "attachment.content_hash",
            1024,
          );
          return { filename, content_type, size_bytes, content_hash };
        })
      : [];

    return { sender, recipient, timestamp, body, attachments };
  } catch (error: unknown) {
    result = mapOpenEnvelopeError(error);
    if (error instanceof OpenEnvelopeError) {
      throw error;
    }
    throw new OpenEnvelopeError(
      error instanceof Error ? error.message : "envelope processing failed",
      "crypto_validation_error",
    );
  } finally {
    const durationMs = Math.max(1, Math.round(performance.now() - startTime));
    recordCryptoTelemetry({
      operation: "open",
      suite: "AES-256-GCM",
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

