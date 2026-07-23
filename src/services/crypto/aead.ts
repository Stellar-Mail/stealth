/**
 * AEAD ciphertext/tag wire-format helpers (#1696).
 *
 * Web Crypto appends the GCM tag to the ciphertext, while the envelope also
 * stores the final 16 bytes as `mac`. Duplicating the tag creates ambiguous
 * wire semantics and can break independent decrypt implementations.
 *
 * This module enforces ONE canonical rule: on the wire the `ciphertext` field
 * carries the ciphertext WITHOUT the tag, and the `mac` field carries the tag
 * separately. Seal and open MUST use the same formatter/parser exposed here so
 * the representation is unambiguous. A `splitTag`/`joinTag` pair is provided for
 * explicit conversion to/from the raw Web Crypto (tag-appended) form, so legacy
 * draft data is handled rather than silently misinterpreted. Self-contained.
 */

/** Minimal non-secret error carrying a stable code (no key/plaintext leakage). */
export class AeadError extends Error {
  readonly code = "crypto_validation_error" as const;
  constructor(message: string) {
    super(message);
    this.name = "AeadError";
  }
}

export const GCM_TAG_BYTES = 16;
export const GCM_NONCE_BYTES = 12;

/** The canonical rule this module enforces. */
export const TAG_CONVENTION = "ciphertext-excludes-tag" as const;

function toArrayBufferCopy(u: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(u.length));
  out.set(u);
  return out;
}

/**
 * Convert raw Web Crypto output (ciphertext + appended tag) into the canonical
 * wire representation: { ciphertext (tag stripped), tag }.
 */
export function splitTag(combined: Uint8Array): {
  ciphertext: Uint8Array<ArrayBuffer>;
  tag: Uint8Array<ArrayBuffer>;
} {
  if (combined.length < GCM_TAG_BYTES) {
    throw new AeadError("combined ciphertext shorter than auth tag");
  }
  const ciphertext = toArrayBufferCopy(combined.slice(0, combined.length - GCM_TAG_BYTES));
  const tag = toArrayBufferCopy(combined.slice(combined.length - GCM_TAG_BYTES));
  return { ciphertext, tag };
}

/**
 * Recombine canonical ciphertext + tag back into the raw Web Crypto form
 * (ciphertext || tag) for decryption. This is the single formatter used by
 * both seal and open, so the two never diverge.
 */
export function joinTag(ciphertext: Uint8Array, tag: Uint8Array): Uint8Array<ArrayBuffer> {
  if (tag.length !== GCM_TAG_BYTES) {
    throw new AeadError("auth tag must be exactly 16 bytes");
  }
  const out = new Uint8Array(new ArrayBuffer(ciphertext.length + tag.length));
  out.set(toArrayBufferCopy(ciphertext), 0);
  out.set(toArrayBufferCopy(tag), ciphertext.length);
  return out;
}

export interface SealAeadResult {
  ciphertext: Uint8Array<ArrayBuffer>;
  tag: Uint8Array<ArrayBuffer>;
  nonce: Uint8Array<ArrayBuffer>;
}

/**
 * Seal a plaintext with AES-256-GCM using a caller-supplied key. Returns the
 * canonical representation: ciphertext (tag stripped) + separate tag + nonce.
 * The returned ciphertext and tag are the exact bytes to place on the wire.
 */
export async function sealAead(
  key: CryptoKey,
  plaintext: Uint8Array,
  nonce?: Uint8Array,
): Promise<SealAeadResult> {
  const iv =
    nonce && nonce.length === GCM_NONCE_BYTES
      ? toArrayBufferCopy(nonce)
      : crypto.getRandomValues(new Uint8Array(GCM_NONCE_BYTES));
  const raw = toArrayBufferCopy(
    new Uint8Array(
      await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, toArrayBufferCopy(plaintext)),
    ),
  );
  const { ciphertext, tag } = splitTag(raw);
  return { ciphertext, tag, nonce: iv };
}

export interface OpenAeadResult {
  plaintext: Uint8Array<ArrayBuffer>;
}

/**
 * Open a canonical AEAD envelope part: decrypt `ciphertext` with `tag` and
 * `nonce` under `key`. Fails closed on any authentication failure. Uses the
 * single `joinTag` formatter so it matches `sealAead` exactly.
 */
export async function openAead(
  key: CryptoKey,
  ciphertext: Uint8Array,
  tag: Uint8Array,
  nonce: Uint8Array,
): Promise<OpenAeadResult> {
  if (tag.length !== GCM_TAG_BYTES) {
    throw new AeadError("auth tag must be exactly 16 bytes");
  }
  const combined = joinTag(ciphertext, tag);
  const iv = toArrayBufferCopy(nonce);
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, combined);
  } catch {
    throw new AeadError("AEAD decryption failed (tampered or wrong key)");
  }
  return { plaintext: toArrayBufferCopy(new Uint8Array(plain)) };
}
