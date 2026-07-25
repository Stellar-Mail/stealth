/**
 * Security and performance guards for Team Security Flagging.
 *
 * All functions are pure and synchronous — no I/O, no side effects.
 * Designed to be called at the entry point before touching business
 * logic or iterating over collections.
 *
 * ## Layer model
 *
 *   caller input
 *       │
 *       ▼
 *   guardSecurityFlaggingInput(payload)     ← early size + type pre-check
 *       │
 *       ▼
 *   validateCreateFlagInput(input)          ← field-level validation
 *       │
 *       ▼
 *   core service (classifyEmail, etc.)     ← business logic
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const LIMITS = Object.freeze({
  /**
   * Maximum serialized payload size in bytes.
   * Rejected before any field validation or classification begins.
   */
  MAX_BODY_BYTES: 65536,

  /**
   * Intended rate ceiling: maximum flag creation calls per team per minute.
   * Not enforced in this module — a production integration should enforce
   * at the API gateway or auth layer.
   */
  MAX_CALLS_PER_WINDOW: 100,

  /**
   * Maximum IDs to check in a single batch-deduplication call.
   */
  MAX_DEDUP_BATCH_SIZE: 500,
});

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class SecurityGuardError extends Error {
  constructor(message, field) {
    super(message);
    this.name = "SecurityGuardError";
    this.field = field ?? null;
  }
}

// ---------------------------------------------------------------------------
// Pre-validation guard
// ---------------------------------------------------------------------------

/**
 * Pre-checks a deserialized security flagging payload before any
 * field-level validation or classification work.
 *
 * Guards against:
 *  - Non-object / null / array input
 *  - Oversized serialized payloads (> MAX_BODY_BYTES)
 *
 * Returns the input unchanged on success. Throws SecurityGuardError
 * with the offending field named.
 *
 * @param {unknown} input
 * @returns {object}
 */
export function guardSecurityFlaggingInput(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new SecurityGuardError("Input must be a plain object", "input");
  }

  const serialized = JSON.stringify(input);
  if (serialized.length > LIMITS.MAX_BODY_BYTES) {
    throw new SecurityGuardError(
      `Input exceeds maximum size of ${LIMITS.MAX_BODY_BYTES} bytes`,
      "input",
    );
  }

  return /** @type {object} */ (input);
}

// ---------------------------------------------------------------------------
// Collection-size guards
// ---------------------------------------------------------------------------

/**
 * Guard against processing an oversized batch of deduplication lookups.
 *
 * @param {unknown} items
 * @returns {true}
 */
export function guardDedupBatchSize(items) {
  if (!Array.isArray(items)) {
    throw new SecurityGuardError("Dedup batch must be an array", "items");
  }
  if (items.length > LIMITS.MAX_DEDUP_BATCH_SIZE) {
    throw new SecurityGuardError(
      `Dedup batch size ${items.length} exceeds safe limit of ${LIMITS.MAX_DEDUP_BATCH_SIZE}`,
      "items",
    );
  }
  return true;
}

// ---------------------------------------------------------------------------
// Wrapped composite guard
// ---------------------------------------------------------------------------

/**
 * Complete entry guard: runs pre-check + field-level validation.
 * Returns the normalized input on success. Throws SecurityGuardError
 * for pre-check failures, or the existing validator errors for field
 * failures.
 *
 * @param {unknown} raw
 * @param {(input: object) => boolean} validateInput
 * @returns {object}
 */
export function guardAndValidate(raw, validateInput) {
  const input = guardSecurityFlaggingInput(raw);
  validateInput(input);
  return input;
}

export { LIMITS as GUARD_LIMITS };
