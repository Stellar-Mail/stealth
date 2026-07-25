/**
 * Multi-recipient envelope encryption (#1702).
 *
 * The send pipeline encrypts a body for a single recipient. This module adds
 * secure multi-recipient support using the standard envelope pattern: the body
 * is encrypted exactly once under a random content-encryption key (CEK), and
 * the CEK is then wrapped independently for each validated recipient. Every
 * recipient can therefore unwrap the same CEK on its own, no recipient can use
 * another recipient's wrapped-key entry, and any tampering fails closed.
 *
 * Uses only Web Crypto (AES-256-GCM for the content and for key wrapping,
 * HKDF-SHA-256 to derive a per-recipient wrapping key bound to the recipient
 * id). It is intentionally self-contained (its own minimal error type, no
 * dependency on the other crypto modules) so it is independently mergeable and
 * testable, matching the conventions of the surrounding crypto services.
 */

type MultiRecipientErrorCode =
  | "crypto_validation_error"
  | "crypto_key_error"
  | "crypto_decrypt_error";

/** Minimal non-secret error carrying a stable code (no key/plaintext leakage). */
export class MultiRecipientError extends Error {
  readonly code: MultiRecipientErrorCode;
  constructor(code: MultiRecipientErrorCode, message: string) {
    super(message);
    this.name = "MultiRecipientError";
    this.code = code;
  }
}

export const MULTI_RECIPIENT_VERSION = "mr.v1" as const;

const CEK_BYTES = 32;
const GCM_NONCE_BYTES = 12;
const WRAP_INFO = "stealth-multi-recipient-wrap-v1";

/** A recipient's stable id plus the long-term secret used to wrap keys for it. */
export interface RecipientKey {
  readonly id: string;
  readonly keyMaterial: Uint8Array;
}

/** One recipient-specific wrapped copy of the content-encryption key. */
export interface WrappedKeyEntry {
  readonly recipientId: string;
  readonly nonce: string;
  readonly wrappedKey: string;
}

/** The multi-recipient envelope placed on the wire. */
export interface MultiRecipientEnvelope {
  readonly version: typeof MULTI_RECIPIENT_VERSION;
  readonly body: { readonly nonce: string; readonly ciphertext: string };
  readonly recipients: readonly WrappedKeyEntry[];
}

function copyBytes(u: Uint8Array): Uint8Array {
  const out = new Uint8Array(u.length);
  out.set(u);
  return out;
}

/**
 * Copy bytes into a fresh ArrayBuffer. Web Crypto expects a BufferSource, and
 * an ArrayBuffer is unconditionally assignable to it; a bare Uint8Array is not,
 * because the DOM lib types allow it to be backed by a SharedArrayBuffer. Every
 * byte argument handed to crypto.subtle is therefore funneled through this.
 */
function toBuffer(u: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(u.byteLength);
  new Uint8Array(out).set(u);
  return out;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

function canonicalId(id: unknown): string {
  if (typeof id !== "string" || id.trim() === "") {
    throw new MultiRecipientError(
      "crypto_validation_error",
      "recipient id must be a non-empty string",
    );
  }
  return id.trim().toLowerCase();
}

/**
 * Validate, normalize, and deduplicate recipients. Ids are canonicalized
 * (trimmed and lowercased). Exact duplicates (same id and identical key
 * material) collapse to a single entry; a repeated id with conflicting key
 * material is rejected. The result is sorted by id for deterministic output.
 */
export function normalizeRecipients(recipients: readonly RecipientKey[]): RecipientKey[] {
  if (!Array.isArray(recipients) || recipients.length === 0) {
    throw new MultiRecipientError("crypto_validation_error", "at least one recipient is required");
  }
  const byId = new Map<string, RecipientKey>();
  for (const recipient of recipients) {
    if (!recipient || typeof recipient !== "object") {
      throw new MultiRecipientError("crypto_validation_error", "each recipient must be an object");
    }
    const id = canonicalId(recipient.id);
    if (!(recipient.keyMaterial instanceof Uint8Array) || recipient.keyMaterial.length === 0) {
      throw new MultiRecipientError(
        "crypto_key_error",
        "recipient key material must be non-empty bytes",
      );
    }
    const existing = byId.get(id);
    if (existing) {
      if (!bytesEqual(existing.keyMaterial, recipient.keyMaterial)) {
        throw new MultiRecipientError(
          "crypto_validation_error",
          "duplicate recipient id with conflicting key material",
        );
      }
      continue;
    }
    byId.set(id, { id, keyMaterial: copyBytes(recipient.keyMaterial) });
  }
  return Array.from(byId.values()).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

async function deriveWrappingKey(keyMaterial: Uint8Array, recipientId: string): Promise<CryptoKey> {
  const ikm = await crypto.subtle.importKey("raw", toBuffer(keyMaterial), "HKDF", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: toBuffer(new TextEncoder().encode(recipientId)),
      info: toBuffer(new TextEncoder().encode(WRAP_INFO)),
    },
    ikm,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Encrypt `body` once and produce a wrapped-key entry for every validated
 * recipient. Throws MultiRecipientError on invalid input.
 */
export async function sealMultiRecipient(
  body: Uint8Array,
  recipients: readonly RecipientKey[],
): Promise<MultiRecipientEnvelope> {
  if (!(body instanceof Uint8Array)) {
    throw new MultiRecipientError("crypto_validation_error", "body must be a Uint8Array");
  }
  const normalized = normalizeRecipients(recipients);

  const cekBytes = crypto.getRandomValues(new Uint8Array(CEK_BYTES));
  const cek = await crypto.subtle.importKey(
    "raw",
    toBuffer(cekBytes),
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );

  const bodyNonce = crypto.getRandomValues(new Uint8Array(GCM_NONCE_BYTES));
  const bodyCipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: toBuffer(bodyNonce) }, cek, toBuffer(body)),
  );

  const entries: WrappedKeyEntry[] = [];
  for (const recipient of normalized) {
    const wrappingKey = await deriveWrappingKey(recipient.keyMaterial, recipient.id);
    const wrapNonce = crypto.getRandomValues(new Uint8Array(GCM_NONCE_BYTES));
    const wrapped = new Uint8Array(
      await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: toBuffer(wrapNonce) },
        wrappingKey,
        toBuffer(cekBytes),
      ),
    );
    entries.push({
      recipientId: recipient.id,
      nonce: toBase64(wrapNonce),
      wrappedKey: toBase64(wrapped),
    });
  }

  cekBytes.fill(0);

  return {
    version: MULTI_RECIPIENT_VERSION,
    body: { nonce: toBase64(bodyNonce), ciphertext: toBase64(bodyCipher) },
    recipients: entries,
  };
}

/**
 * Unwrap the content key for a single recipient and decrypt the body. Fails
 * closed (throws) if the recipient has no entry, the key material is wrong, or
 * any ciphertext has been tampered with.
 */
export async function openMultiRecipient(
  envelope: MultiRecipientEnvelope,
  recipientId: string,
  keyMaterial: Uint8Array,
): Promise<Uint8Array> {
  if (!envelope || envelope.version !== MULTI_RECIPIENT_VERSION) {
    throw new MultiRecipientError("crypto_validation_error", "unsupported or malformed envelope");
  }
  const id = canonicalId(recipientId);
  if (!(keyMaterial instanceof Uint8Array) || keyMaterial.length === 0) {
    throw new MultiRecipientError(
      "crypto_key_error",
      "recipient key material must be non-empty bytes",
    );
  }

  const entry = envelope.recipients.find((candidate) => candidate.recipientId === id);
  if (!entry) {
    throw new MultiRecipientError("crypto_key_error", "no wrapped key entry for this recipient");
  }

  const wrappingKey = await deriveWrappingKey(keyMaterial, id);
  let cekBytes: Uint8Array;
  try {
    cekBytes = new Uint8Array(
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: toBuffer(fromBase64(entry.nonce)) },
        wrappingKey,
        toBuffer(fromBase64(entry.wrappedKey)),
      ),
    );
  } catch {
    throw new MultiRecipientError(
      "crypto_decrypt_error",
      "wrapped key could not be unwrapped (tampered or wrong recipient)",
    );
  }

  const cek = await crypto.subtle.importKey(
    "raw",
    toBuffer(cekBytes),
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
  cekBytes.fill(0);

  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: toBuffer(fromBase64(envelope.body.nonce)) },
      cek,
      toBuffer(fromBase64(envelope.body.ciphertext)),
    );
    return new Uint8Array(plaintext);
  } catch {
    throw new MultiRecipientError(
      "crypto_decrypt_error",
      "message body could not be decrypted (tampered)",
    );
  }
}
