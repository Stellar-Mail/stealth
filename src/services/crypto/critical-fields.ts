/**
 * Critical fields representation and fail-closed validation (#1691).
 *
 * Implements critical field checking for cryptographic envelopes.
 * Standard fields and registered extension fields listed in the `critical` array
 * must be present in the payload. Unknown critical field names, missing payload
 * properties declared as critical, or duplicate entries in the `critical` array
 * cause validation to fail closed before any cryptographic operations occur.
 *
 * Unknown optional fields (fields not listed in `critical`) are permitted for
 * forward/backward compatibility according to specification.
 */

import { CryptoError } from "./errors";

/** Standard payload fields known by default */
export const KNOWN_STANDARD_CRITICAL_FIELDS = new Set<string>([
  "version",
  "sender",
  "recipient",
  "timestamp",
  "encryption_metadata",
  "content_commitment",
  "attachments",
  "critical",
]);

/** Set of dynamically registered critical extension fields */
const registeredCriticalExtensionFields = new Set<string>();

/**
 * Register a security-relevant extension field name.
 */
export function registerCriticalField(fieldName: string): void {
  if (typeof fieldName === "string" && fieldName.trim().length > 0) {
    registeredCriticalExtensionFields.add(fieldName.trim());
  }
}

/**
 * Reset registered critical extensions (useful for testing).
 */
export function resetRegisteredCriticalFields(): void {
  registeredCriticalExtensionFields.clear();
}

/**
 * Retrieve all known and registered critical field names.
 */
export function getRegisteredCriticalFields(): Set<string> {
  const combined = new Set<string>(KNOWN_STANDARD_CRITICAL_FIELDS);
  for (const ext of registeredCriticalExtensionFields) {
    combined.add(ext);
  }
  return combined;
}

/**
 * Check if a field name is known as a valid critical field.
 */
export function isKnownCriticalField(fieldName: string): boolean {
  return (
    KNOWN_STANDARD_CRITICAL_FIELDS.has(fieldName) ||
    registeredCriticalExtensionFields.has(fieldName)
  );
}

/**
 * Validate `critical` field declaration and payload properties.
 *
 * Enforces fail-closed validation:
 * 1. `critical` must be an array of non-empty strings if provided.
 * 2. `critical` must not contain duplicate entries.
 * 3. Every entry in `critical` must be a known/registered critical field.
 * 4. Every entry in `critical` must have a defined property value on the payload object.
 *
 * @throws {CryptoError} code: "crypto_validation_error" if validation fails.
 */
export function validateCriticalFields(payload: Record<string, unknown>): void {
  if (!payload || typeof payload !== "object") {
    throw new CryptoError("crypto_validation_error", "Payload must be a non-null object");
  }

  const criticalRaw = payload.critical;

  if (criticalRaw === undefined || criticalRaw === null) {
    return;
  }

  if (!Array.isArray(criticalRaw)) {
    throw new CryptoError("crypto_validation_error", "critical field must be an array of strings");
  }

  const seen = new Set<string>();

  for (const field of criticalRaw) {
    if (typeof field !== "string" || field.trim().length === 0) {
      throw new CryptoError(
        "crypto_validation_error",
        "critical array items must be non-empty strings",
      );
    }

    const trimmed = field.trim();

    // Check duplicates
    if (seen.has(trimmed)) {
      throw new CryptoError(
        "crypto_validation_error",
        `Duplicate entry in critical array: ${trimmed}`,
      );
    }
    seen.add(trimmed);

    // Unknown critical names fail closed
    if (!isKnownCriticalField(trimmed)) {
      throw new CryptoError(
        "crypto_validation_error",
        `Unknown mandatory critical field: ${trimmed}`,
      );
    }

    // Missing critical payload properties fail closed
    if (payload[trimmed] === undefined) {
      throw new CryptoError(
        "crypto_validation_error",
        `Missing mandatory critical field value: ${trimmed}`,
      );
    }
  }
}
