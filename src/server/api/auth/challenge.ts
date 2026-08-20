import { ApiError } from "../errors";

export const DEFAULT_AUTH_CHALLENGE_LIFETIME_MS = 5 * 60 * 1000;
export const DEFAULT_AUTH_CLOCK_SKEW_MS = 30 * 1000;

export interface AuthChallengeConfig {
  /** Maximum age of a challenge, excluding clock-skew tolerance. */
  readonly lifetimeMs: number;
  /** Time allowed on either side of the validity window for clock differences. */
  readonly clockSkewMs: number;
}

export interface AuthChallengeTiming {
  readonly issuedAt: string;
  readonly expiresAt: string;
}

/**
 * Stable machine-readable reasons for authentication timing failures.
 *
 * These accompany the public API error codes `expired_challenge` and
 * `challenge_not_yet_valid` in the error details, so a client can distinguish
 * "your clock is behind" from "your clock is ahead" without parsing prose.
 */
export const AUTH_TIMING_REASONS = {
  expired: "AUTH_EXPIRED",
  notYetValid: "AUTH_NOT_YET_VALID",
} as const;

export type AuthTimingReason = (typeof AUTH_TIMING_REASONS)[keyof typeof AUTH_TIMING_REASONS];

export interface AuthChallengeValidationOptions extends Partial<AuthChallengeConfig> {
  /** Injectable clock for deterministic validation and tests. */
  readonly now?: () => number;
  /**
   * Expiry stamped on the challenge when it was issued. When present it is
   * authoritative, so reconfiguring the lifetime never retroactively extends
   * or shortens challenges already in flight. Falls back to
   * `issuedAt + lifetimeMs`.
   */
  readonly expiresAt?: string | Date | number;
}

/** Normalizes the accepted timestamp shapes to epoch milliseconds. */
function toEpochMs(value: string | Date | number): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return Date.parse(value);
}

type AuthChallengeEnvironment = Record<string, string | undefined>;

function parseDuration(
  value: string | undefined,
  name: string,
  fallback: number,
  allowZero: boolean,
): number {
  if (value === undefined || value.trim() === "") return fallback;

  const duration = Number(value);
  const minimum = allowZero ? 0 : 1;
  if (!Number.isSafeInteger(duration) || duration < minimum) {
    throw new Error(
      `Configuration error: ${name} must be ${
        allowZero ? "a non-negative" : "a positive"
      } integer number of milliseconds.`,
    );
  }
  return duration;
}

/** Loads the challenge validity policy from the API's environment configuration. */
export function getAuthChallengeConfig(
  environment: AuthChallengeEnvironment = process.env,
): AuthChallengeConfig {
  return {
    lifetimeMs: parseDuration(
      environment.STEALTH_AUTH_CHALLENGE_LIFETIME_MS,
      "STEALTH_AUTH_CHALLENGE_LIFETIME_MS",
      DEFAULT_AUTH_CHALLENGE_LIFETIME_MS,
      false,
    ),
    clockSkewMs: parseDuration(
      environment.STEALTH_AUTH_CLOCK_SKEW_MS,
      "STEALTH_AUTH_CLOCK_SKEW_MS",
      DEFAULT_AUTH_CLOCK_SKEW_MS,
      true,
    ),
  };
}

/** Creates canonical challenge timestamps using the same lifetime policy as validation. */
export function createAuthChallengeTiming(
  options: AuthChallengeValidationOptions = {},
): AuthChallengeTiming {
  const configured = getAuthChallengeConfig();
  const lifetimeMs = options.lifetimeMs ?? configured.lifetimeMs;
  const nowMs = (options.now ?? Date.now)();
  return {
    issuedAt: new Date(nowMs).toISOString(),
    expiresAt: new Date(nowMs + lifetimeMs).toISOString(),
  };
}

/**
 * Enforces the shared authentication challenge validity window.
 *
 * Both boundaries are inclusive: `issuedAt - skew <= now <= expiresAt + skew`,
 * where `expiresAt` defaults to `issuedAt + lifetime`. A request exactly on
 * either boundary is valid; one millisecond beyond it is rejected.
 *
 * Failures carry a stable machine-readable reason in the error details:
 * `AUTH_NOT_YET_VALID` before the window, `AUTH_EXPIRED` after it.
 */
export function validateAuthChallengeTimestamp(
  issuedAt: string | Date | number,
  options: AuthChallengeValidationOptions = {},
): void {
  const configured = getAuthChallengeConfig();
  const lifetimeMs = options.lifetimeMs ?? configured.lifetimeMs;
  const clockSkewMs = options.clockSkewMs ?? configured.clockSkewMs;
  const issuedAtMs = toEpochMs(issuedAt);

  if (!Number.isFinite(issuedAtMs)) {
    throw new ApiError("validation_error", { field: "issuedAt" });
  }

  const expiresAtMs =
    options.expiresAt === undefined ? issuedAtMs + lifetimeMs : toEpochMs(options.expiresAt);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs < issuedAtMs) {
    throw new ApiError("validation_error", { field: "expiresAt" });
  }

  const nowMs = (options.now ?? Date.now)();
  if (nowMs < issuedAtMs - clockSkewMs) {
    throw new ApiError("challenge_not_yet_valid", {
      reason: AUTH_TIMING_REASONS.notYetValid,
    });
  }
  if (nowMs > expiresAtMs + clockSkewMs) {
    throw new ApiError("expired_challenge", {
      reason: AUTH_TIMING_REASONS.expired,
    });
  }
}
