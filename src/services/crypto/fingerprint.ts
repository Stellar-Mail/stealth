import { canonicalize } from "./jcs";
import { type SealedEnvelope } from "./envelope";
import { sealedEnvelopeSchema } from "./schema";

const FINGERPRINT_VERSION = "v1";

/**
 * Derives a versioned, cryptographic fingerprint of a sealed envelope.
 * The fingerprint is deterministic and binds all protected metadata fields
 * (sender, recipient, timestamp, commitment, attachments, etc.) along with
 * the ciphertext, completely excluding any plaintext.
 *
 * Format: `v1:fp:sha256:<64-hex-chars>`
 *
 * @param envelope The sealed envelope to fingerprint.
 * @returns A promise resolving to the versioned fingerprint string.
 */
export async function deriveEnvelopeFingerprint(envelope: SealedEnvelope): Promise<string> {
  // Validate the envelope structure using the schema to ensure we only
  // fingerprint valid structures.
  const validated = sealedEnvelopeSchema.parse(envelope);

  // Canonicalize the validated sealed envelope to produce a stable JSON string representation.
  const canonicalString = canonicalize(validated);

  // Compute SHA-256 hash of the canonical representation.
  const data = new TextEncoder().encode(canonicalString);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hexDigest = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  return `${FINGERPRINT_VERSION}:fp:sha256:${hexDigest}`;
}

/**
 * Simple interface for tracking seen fingerprints.
 * Decouples storage details (e.g. Memory, Redis, PostgreSQL) from primitive crypto code.
 */
export interface ReplayStore {
  has(fingerprint: string): boolean | Promise<boolean>;
  add(fingerprint: string): void | Promise<void>;
}

/**
 * Checks if a given envelope fingerprint is a replay (already processed).
 * If not a replay, adds it to the store.
 *
 * @param fingerprint The envelope fingerprint to check.
 * @param store The storage driver implementing ReplayStore.
 * @returns A promise resolving to true if replay detected (fingerprint seen), false otherwise.
 */
export async function checkReplay(fingerprint: string, store: ReplayStore): Promise<boolean> {
  const isSeen = await store.has(fingerprint);
  if (isSeen) {
    return true;
  }
  await store.add(fingerprint);
  return false;
}
