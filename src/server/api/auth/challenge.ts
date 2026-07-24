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

export interface AuthChallengeValidationOptions extends Partial<AuthChallengeConfig> {
  /** Injectable clock for deterministic validation and tests. */
  readonly now?: () => number;
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
      `Configuration error: ${name} must be ${allowZero ? "a non-negative" : "a positive"} integer number of milliseconds.`,
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
 * Both boundaries are inclusive: issuedAt - skew <= now <= issuedAt + lifetime + skew.
 */
export function validateAuthChallengeTimestamp(
  issuedAt: string | Date | number,
  options: AuthChallengeValidationOptions = {},
): void {
  const configured = getAuthChallengeConfig();
  const lifetimeMs = options.lifetimeMs ?? configured.lifetimeMs;
  const clockSkewMs = options.clockSkewMs ?? configured.clockSkewMs;
  const issuedAtMs =
    issuedAt instanceof Date
      ? issuedAt.getTime()
      : typeof issuedAt === "number"
        ? issuedAt
        : Date.parse(issuedAt);

  if (!Number.isFinite(issuedAtMs)) {
    throw new ApiError("validation_error", { field: "issuedAt" });
  }

  const nowMs = (options.now ?? Date.now)();
  if (issuedAtMs - nowMs > clockSkewMs) {
    throw new ApiError("challenge_not_yet_valid");
  }
  if (nowMs - issuedAtMs > lifetimeMs + clockSkewMs) {
    throw new ApiError("expired_challenge");
  }
}
