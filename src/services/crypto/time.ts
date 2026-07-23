/**
 * Envelope timestamp validation with bounded clock skew (#1710).
 *
 * `sealEnvelope` writes the current ISO timestamp, but the crypto folder had no
 * validation for malformed, stale, or excessively future timestamps. Signatures
 * and replay controls need a clear temporal validity policy.
 *
 * This module parses strict UTC ISO-8601 timestamps and validates them against
 * configurable maximum age and future-skew bounds using an injectable clock, so
 * tests are deterministic. Self-contained (local TimestampError).
 */

/** Minimal non-secret error carrying a stable code (no key/plaintext leakage). */
export class TimestampError extends Error {
  readonly code = "crypto_validation_error" as const;
  constructor(message: string) {
    super(message);
    this.name = "TimestampError";
  }
}

/** A clock abstraction so tests can control "now". */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

export interface TimestampPolicy {
  /** Maximum allowed age of a timestamp (milliseconds). */
  maxAgeMs: number;
  /** Maximum allowed future skew of a timestamp (milliseconds). */
  maxFutureSkewMs: number;
  /** Clock used to evaluate "now" (defaults to the system clock). */
  clock?: Clock;
}

/**
 * Parse a strict UTC ISO-8601 timestamp.
 * Rejects empty, non-UTC (must end in Z or +00:00), or unparseable values.
 */
export function parseUtcTimestamp(value: string): Date {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TimestampError("timestamp must be a non-empty string");
  }
  const trimmed = value.trim();
  // Require an explicit UTC designator: trailing 'Z' or '(+|-)HH:MM' offset of 00:00.
  const hasZ = trimmed.endsWith("Z");
  const utcOffset = /[+-]\d{2}:\d{2}$/.exec(trimmed);
  const isUtcOffset =
    utcOffset !== null && (utcOffset[0] === "+00:00" || utcOffset[0] === "-00:00");
  if (!hasZ && !isUtcOffset) {
    throw new TimestampError("timestamp must be UTC (end with Z or +00:00)");
  }

  const normalized = hasZ ? trimmed.slice(0, -1) + "+00:00" : trimmed;
  const ms = Date.parse(normalized);
  if (Number.isNaN(ms)) {
    throw new TimestampError("timestamp is not a valid ISO-8601 date");
  }
  return new Date(ms);
}

/**
 * Validate a timestamp against the policy. Throws TimestampError when the value
 * is malformed, too old (age > maxAgeMs), or too far in the future
 * (skew > maxFutureSkewMs). Boundary values (exactly at the limit) are allowed.
 */
export function validateTimestamp(value: string, policy: TimestampPolicy): Date {
  const date = parseUtcTimestamp(value);
  const clock = policy.clock ?? systemClock;
  const nowMs = clock.now().getTime();
  const tsMs = date.getTime();
  const age = nowMs - tsMs;
  const skew = tsMs - nowMs;

  if (age > policy.maxAgeMs) {
    throw new TimestampError("timestamp is too old");
  }
  if (skew > policy.maxFutureSkewMs) {
    throw new TimestampError("timestamp is too far in the future");
  }
  return date;
}
