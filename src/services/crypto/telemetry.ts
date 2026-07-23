/**
 * Crypto telemetry adapter (#1735).
 *
 * Operators need failure rates and latency information for crypto operations
 * without exposing addresses, ciphertext, signatures, nonces, or key
 * identifiers. This module provides a narrow telemetry interface emitting
 * fixed event names, suite versions, duration buckets, and non-sensitive
 * result codes.
 *
 * Design constraints:
 * - Telemetry never emits plaintext, ciphertext, keys, signatures, addresses,
 *   nonces, or raw identifiers.
 * - All metric labels have bounded cardinality (fixed enums).
 * - Telemetry failures never affect crypto operations.
 * - The adapter is configurable with a default no-op implementation.
 */

// ---------------------------------------------------------------------------
// Bounded event types (fixed cardinality)
// ---------------------------------------------------------------------------

/** Fixed operation names emitted by crypto telemetry. */
export type CryptoOperation =
  | "seal"
  | "open"
  | "key_resolve"
  | "kdf"
  | "nonce_generate"
  | "identity_normalize";

/** Fixed result codes (maps to existing CryptoErrorCode taxonomy). */
export type CryptoResultCode =
  | "success"
  | "error_parse"
  | "error_validation"
  | "error_algorithm"
  | "error_key"
  | "error_signature"
  | "error_commitment"
  | "error_decrypt"
  | "error_version"
  | "error_integrity";

// ---------------------------------------------------------------------------
// Event interface
// ---------------------------------------------------------------------------

/** A single telemetry event emitted after a crypto operation completes. */
export interface CryptoTelemetryEvent {
  /** The operation that was performed (bounded enum). */
  readonly operation: CryptoOperation;
  /** The algorithm suite used, if applicable (from CRYPTO_SUITE_REGISTRY). */
  readonly suite?: string;
  /** The outcome of the operation (bounded enum). */
  readonly result: CryptoResultCode;
  /** Wall-clock duration in milliseconds (positive integer). */
  readonly durationMs: number;
  /** Optional non-sensitive error code (from errors.ts CryptoErrorCode). */
  readonly errorCode?: string;
}

// ---------------------------------------------------------------------------
// Adapter interface
// ---------------------------------------------------------------------------

/**
 * A telemetry adapter receives crypto operation events.
 *
 * Implementations must:
 * - Not throw (the adapter wrapper catches all errors).
 * - Not retain references to event objects after returning.
 * - Not emit or log sensitive data (plaintext, keys, addresses, etc.).
 */
export interface CryptoTelemetryAdapter {
  record(event: CryptoTelemetryEvent): void;
}

// ---------------------------------------------------------------------------
// Module-level adapter (configurable, default no-op)
// ---------------------------------------------------------------------------

/** Default no-op adapter: silently discards all events. */
const noopAdapter: CryptoTelemetryAdapter = { record() {} };

let currentAdapter: CryptoTelemetryAdapter = noopAdapter;

/**
 * Register a telemetry adapter. All subsequent crypto operations will emit
 * events to this adapter. Passing `null` or `undefined` resets to the
 * default no-op adapter.
 */
export function setCryptoTelemetryAdapter(
  adapter: CryptoTelemetryAdapter | null | undefined,
): void {
  currentAdapter = adapter ?? noopAdapter;
}

/** Return the currently registered telemetry adapter. */
export function getCryptoTelemetryAdapter(): CryptoTelemetryAdapter {
  return currentAdapter;
}

// ---------------------------------------------------------------------------
// Recording helper (safety wrapper)
// ---------------------------------------------------------------------------

/**
 * Record a telemetry event. If the adapter throws, the error is swallowed
 * so that crypto operations are never affected by telemetry failures.
 */
export function recordCryptoTelemetry(event: CryptoTelemetryEvent): void {
  try {
    currentAdapter.record(event);
  } catch {
    // Telemetry failures must never fail crypto operations.
  }
}

// ---------------------------------------------------------------------------
// Duration measurement helper
// ---------------------------------------------------------------------------

/**
 * Measure and record the duration of a synchronous or async crypto operation.
 *
 * @param operation  The bounded operation name.
 * @param fn         The operation to execute.
 * @param resultMap  Optional function to derive the result code from the
 *                   return value. Defaults to "success" when `fn` returns
 *                   without throwing.
 * @returns          The value returned by `fn`.
 */
export function measureOperation<T>(
  operation: CryptoOperation,
  fn: () => T,
  resultMap?: (value: T) => CryptoResultCode,
): T;

export function measureOperation<T>(
  operation: CryptoOperation,
  fn: () => Promise<T>,
  resultMap?: (value: T) => CryptoResultCode,
): Promise<T>;

export function measureOperation<T>(
  operation: CryptoOperation,
  fn: () => T | Promise<T>,
  resultMap?: (value: T) => CryptoResultCode,
): T | Promise<T> {
  const start = performance.now();

  try {
    const result = fn();

    if (result && typeof (result as Promise<T>).then === "function") {
      return (result as Promise<T>).then(
        (value) => {
          emit(operation, start, "success", resultMap?.(value));
          return value;
        },
        (error: unknown) => {
          emit(operation, start, resultToCode(error));
          throw error;
        },
      );
    }

    emit(operation, start, "success", resultMap?.(result as T));
    return result;
  } catch (error: unknown) {
    emit(operation, start, resultToCode(error));
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function emit(
  operation: CryptoOperation,
  start: number,
  defaultResult: CryptoResultCode,
  resultOverride?: CryptoResultCode,
  errorCode?: string,
): void {
  const durationMs = Math.max(1, Math.round(performance.now() - start));
  recordCryptoTelemetry({
    operation,
    result: resultOverride ?? defaultResult,
    durationMs,
    ...(errorCode !== undefined ? { errorCode } : {}),
  });
}

/** Map a caught error to a bounded result code without leaking details. */
function resultToCode(error: unknown): CryptoResultCode {
  if (error !== null && typeof error === "object" && "code" in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === "string") {
      return codeToResult(code);
    }
  }
  return "error_parse";
}

function codeToResult(code: string): CryptoResultCode {
  switch (code) {
    case "crypto_parse_error":
      return "error_parse";
    case "crypto_validation_error":
      return "error_validation";
    case "crypto_algorithm_error":
      return "error_algorithm";
    case "crypto_key_error":
      return "error_key";
    case "crypto_signature_error":
      return "error_signature";
    case "crypto_commitment_error":
      return "error_commitment";
    case "crypto_decrypt_error":
      return "error_decrypt";
    case "crypto_version_error":
      return "error_version";
    case "crypto_integrity_error":
      return "error_integrity";
    default:
      return "error_parse";
  }
}
