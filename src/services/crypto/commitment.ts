/**
 * Versioned content commitments for cryptographic payloads.
 *
 * Implements a structured, versioned format for content commitments
 * specifying the hashing algorithm, encoding, and target.
 *
 * Commitment Format:
 * `<version>:<algorithm>:<encoding>:<digest>`
 *
 * Example:
 * `v1:sha256:hex:a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e`
 *
 * Byte Sequence Documented (v1):
 * - The target of the commitment is the full encrypted ciphertext bytes
 *   including the appended AES-GCM authentication tag (exactly the byte array
 *   output of `crypto.subtle.encrypt`).
 */

import { CryptoError } from "./errors";

const SUPPORTED_VERSION = "v1";
const SUPPORTED_ALGORITHM = "sha256";
const SUPPORTED_ENCODING = "hex";

/**
 * Creates a versioned commitment string for the given ciphertext bytes.
 *
 * @param ciphertext The raw encrypted ciphertext bytes (including auth tag).
 * @returns A promise resolving to the versioned commitment string.
 */
export async function createCommitment(ciphertext: Uint8Array): Promise<string> {
  if (!ciphertext || ciphertext.length === 0) {
    throw new CryptoError("crypto_commitment_error", "Ciphertext cannot be empty");
  }

  // Compute SHA-256 digest
  const hashBuffer = await crypto.subtle.digest("SHA-256", ciphertext as BufferSource);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hexDigest = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  return `${SUPPORTED_VERSION}:${SUPPORTED_ALGORITHM}:${SUPPORTED_ENCODING}:${hexDigest}`;
}

/**
 * Parses and verifies a versioned commitment string against the ciphertext.
 * Throws a stable CryptoError if parsing fails, algorithm is unsupported,
 * or there is a digest mismatch.
 *
 * @param commitment The versioned commitment string to verify.
 * @param ciphertext The raw ciphertext bytes.
 */
export async function verifyCommitment(commitment: string, ciphertext: Uint8Array): Promise<void> {
  if (typeof commitment !== "string") {
    throw new CryptoError("crypto_validation_error", "Commitment must be a string");
  }

  const parts = commitment.split(":");
  if (parts.length !== 4) {
    throw new CryptoError(
      "crypto_parse_error",
      "Malformed commitment string. Expected format: <version>:<algorithm>:<encoding>:<digest>",
    );
  }

  const [version, algorithm, encoding, digest] = parts;

  if (version !== SUPPORTED_VERSION) {
    throw new CryptoError("crypto_algorithm_error", `Unsupported commitment version: ${version}`);
  }

  if (algorithm !== SUPPORTED_ALGORITHM) {
    throw new CryptoError(
      "crypto_algorithm_error",
      `Unsupported commitment algorithm: ${algorithm}`,
    );
  }

  if (encoding !== SUPPORTED_ENCODING) {
    throw new CryptoError("crypto_algorithm_error", `Unsupported commitment encoding: ${encoding}`);
  }

  // Calculate expected digest
  const hashBuffer = await crypto.subtle.digest("SHA-256", ciphertext as BufferSource);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const expectedDigest = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  if (digest !== expectedDigest) {
    throw new CryptoError("crypto_commitment_error", "Content commitment mismatch");
  }
}
