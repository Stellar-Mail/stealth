/**
 * Typed cryptographic error taxonomy (#1690).
 *
 * Callers of the crypto boundary must be able to distinguish failure modes
 * (parse, validation, algorithm, key, signature, commitment, decrypt) without
 * parsing error message text. None of the public messages below may contain
 * key material, plaintext, or other sensitive values.
 */

export type CryptoErrorCode =
  | "crypto_parse_error"
  | "crypto_validation_error"
  | "crypto_algorithm_error"
  | "crypto_key_error"
  | "crypto_signature_error"
  | "crypto_commitment_error"
  | "crypto_decrypt_error";

export interface CryptoErrorDefinition {
  readonly code: CryptoErrorCode;
  readonly publicMessage: string;
  /** Whether the failure is safe to surface to a client (never reveals secrets). */
  readonly safe: boolean;
}

export const CRYPTO_ERROR_REGISTRY: Record<CryptoErrorCode, CryptoErrorDefinition> = {
  crypto_parse_error: {
    code: "crypto_parse_error",
    publicMessage: "The encrypted envelope could not be parsed",
    safe: true,
  },
  crypto_validation_error: {
    code: "crypto_validation_error",
    publicMessage: "The envelope failed input validation",
    safe: true,
  },
  crypto_algorithm_error: {
    code: "crypto_algorithm_error",
    publicMessage: "The requested cryptographic algorithm is unsupported",
    safe: true,
  },
  crypto_key_error: {
    code: "crypto_key_error",
    publicMessage: "A required cryptographic key was missing or unusable",
    safe: true,
  },
  crypto_signature_error: {
    code: "crypto_signature_error",
    publicMessage: "The envelope signature is invalid",
    safe: true,
  },
  crypto_commitment_error: {
    code: "crypto_commitment_error",
    publicMessage: "The content commitment did not match the payload",
    safe: true,
  },
  crypto_decrypt_error: {
    code: "crypto_decrypt_error",
    publicMessage: "The message could not be decrypted",
    safe: true,
  },
};

const CRYPTO_ERROR_CODES = Object.freeze(Object.keys(CRYPTO_ERROR_REGISTRY) as CryptoErrorCode[]);

/**
 * Error thrown for any recoverable failure at the crypto boundary.
 * The message is always a non-secret, registry-defined value.
 */
export class CryptoError extends Error {
  readonly code: CryptoErrorCode;
  readonly safe: boolean;

  constructor(code: CryptoErrorCode, details?: string) {
    const definition = CRYPTO_ERROR_REGISTRY[code];
    // Never interpolate caller-supplied details into the message; the public
    // message is fixed and safe, while structured details stay out of `.message`.
    super(definition.publicMessage);
    this.name = "CryptoError";
    this.code = code;
    this.safe = definition.safe;
    if (details !== undefined) {
      this.details = redact(details);
    }
  }

  /** Optional structured context. Always redacted to avoid leaking secrets. */
  details?: string;
}

/**
 * Strip anything that looks like hex/base64 key material, plaintext, or
 * high-entropy blobs from a value before it is attached to a thrown error.
 * This is a defense-in-depth helper so callers cannot accidentally leak a key
 * or plaintext through error details.
 */
export function redact(value: string): string {
  return value
    .replace(/[0-9a-fA-F]{16,}/g, "[redacted-hex]")
    .replace(/[A-Za-z0-9+/]{16,}={0,2}/g, "[redacted-b64]");
}

/**
 * Map an arbitrary internal error to a stable, non-secret {@link CryptoError}.
 *
 * Mapping strategy:
 * - A `CryptoError` is returned unchanged (its code/message are already safe).
 * - An `Error` with a recognizable code-ish marker is coerced to the matching
 *   taxonomy entry when the code is known.
 * - Anything else (generic `Error`, `SyntaxError`, non-Error) becomes a generic
 *   `crypto_parse_error`/`crypto_decrypt_error` style failure with NO secret
 *   leakage: the original message is discarded and only the safe public message
 *   is surfaced.
 */
export function toCryptoError(error: unknown, fallback: CryptoErrorCode): CryptoError {
  if (error instanceof CryptoError) {
    return error;
  }

  if (error instanceof Error && isKnownCryptoCode(error.message)) {
    return new CryptoError(asCryptoCode(error.message));
  }

  // Never reuse the raw message — it may contain plaintext or key material.
  return new CryptoError(fallback);
}

function isKnownCryptoCode(value: string): value is CryptoErrorCode {
  return (CRYPTO_ERROR_CODES as string[]).includes(value);
}

function asCryptoCode(value: string): CryptoErrorCode {
  return value as CryptoErrorCode;
}

/**
 * Typed result helpers: a union that lets callers branch on `ok` instead of
 * catching and parsing message text.
 */
export type CryptoResult<T> = { ok: true; value: T } | { ok: false; error: CryptoError };

export function cryptoOk<T>(value: T): CryptoResult<T> {
  return { ok: true, value };
}

export function cryptoFail<T = never>(error: CryptoError): CryptoResult<T> {
  return { ok: false, error };
}
