import { describe, expect, it } from "vitest";

import {
  AUTH_TIMING_REASONS,
  createAuthChallengeTiming,
  getAuthChallengeConfig,
  validateAuthChallengeTimestamp,
} from "../../../../src/server/api/auth/challenge";
import { ApiError } from "../../../../src/server/api/errors";

const NOW = Date.parse("2026-07-22T12:00:00.000Z");
const clock =
  (milliseconds = NOW) =>
  () =>
    milliseconds;
const lifetimeMs = 5 * 60 * 1000;
const clockSkewMs = 30 * 1000;

function expectCode(run: () => void, code: string, reason?: string) {
  try {
    run();
    throw new Error("Expected challenge validation to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe(code);
    if (reason !== undefined) {
      expect((error as ApiError).details).toEqual({ reason });
    }
  }
}

describe("authentication challenge timing", () => {
  const options = { lifetimeMs, clockSkewMs, now: clock() };

  it("accepts a challenge within its validity window", () => {
    expect(() => validateAuthChallengeTimestamp(NOW - lifetimeMs, options)).not.toThrow();
  });

  it("rejects an expired challenge with a stable error code", () => {
    expectCode(
      () => validateAuthChallengeTimestamp(NOW - lifetimeMs - clockSkewMs - 1, options),
      "expired_challenge",
    );
  });

  it("accepts a future-dated challenge within allowed clock skew", () => {
    expect(() => validateAuthChallengeTimestamp(NOW + clockSkewMs, options)).not.toThrow();
  });

  it("rejects a future-dated challenge beyond allowed clock skew", () => {
    expectCode(
      () => validateAuthChallengeTimestamp(NOW + clockSkewMs + 1, options),
      "challenge_not_yet_valid",
    );
  });

  it("accepts both exact validity-window boundaries", () => {
    expect(() => validateAuthChallengeTimestamp(NOW + clockSkewMs, options)).not.toThrow();
    expect(() =>
      validateAuthChallengeTimestamp(NOW - lifetimeMs - clockSkewMs, options),
    ).not.toThrow();
  });

  it("reports stable machine-readable reasons for each timing failure", () => {
    expectCode(
      () => validateAuthChallengeTimestamp(NOW - lifetimeMs - clockSkewMs - 1, options),
      "expired_challenge",
      AUTH_TIMING_REASONS.expired,
    );
    expectCode(
      () => validateAuthChallengeTimestamp(NOW + clockSkewMs + 1, options),
      "challenge_not_yet_valid",
      AUTH_TIMING_REASONS.notYetValid,
    );
    expect(AUTH_TIMING_REASONS).toEqual({
      expired: "AUTH_EXPIRED",
      notYetValid: "AUTH_NOT_YET_VALID",
    });
  });

  it("treats the expiry stamped on an issued challenge as authoritative", () => {
    const issuedAt = NOW - 10 * 60 * 1000;

    // A longer stamped expiry keeps an old challenge valid even though the
    // configured lifetime alone would have retired it.
    expect(() =>
      validateAuthChallengeTimestamp(issuedAt, {
        ...options,
        expiresAt: NOW + clockSkewMs,
      }),
    ).not.toThrow();

    // A shorter stamped expiry retires a challenge the configured lifetime
    // would still have accepted.
    expectCode(
      () =>
        validateAuthChallengeTimestamp(NOW - 60_000, {
          ...options,
          expiresAt: NOW - clockSkewMs - 1,
        }),
      "expired_challenge",
      AUTH_TIMING_REASONS.expired,
    );
  });

  it("accepts the exact boundary of a stamped expiry", () => {
    const expiresAt = NOW - clockSkewMs;
    expect(() =>
      validateAuthChallengeTimestamp(NOW - lifetimeMs, {
        ...options,
        expiresAt,
      }),
    ).not.toThrow();
    expectCode(
      () =>
        validateAuthChallengeTimestamp(NOW - lifetimeMs, {
          ...options,
          expiresAt: expiresAt - 1,
        }),
      "expired_challenge",
      AUTH_TIMING_REASONS.expired,
    );
  });

  it("rejects unparseable and inverted challenge timestamps", () => {
    expectCode(() => validateAuthChallengeTimestamp("not-a-date", options), "validation_error");
    expectCode(
      () =>
        validateAuthChallengeTimestamp(NOW, {
          ...options,
          expiresAt: "not-a-date",
        }),
      "validation_error",
    );
    expectCode(
      () => validateAuthChallengeTimestamp(NOW, { ...options, expiresAt: NOW - 1 }),
      "validation_error",
    );
  });

  it("validates a challenge against the timing it was issued with", () => {
    const timing = createAuthChallengeTiming({ lifetimeMs, now: clock() });
    const atExpiry = Date.parse(timing.expiresAt);

    expect(() =>
      validateAuthChallengeTimestamp(timing.issuedAt, {
        ...options,
        expiresAt: timing.expiresAt,
        now: clock(atExpiry + clockSkewMs),
      }),
    ).not.toThrow();
    expectCode(
      () =>
        validateAuthChallengeTimestamp(timing.issuedAt, {
          ...options,
          expiresAt: timing.expiresAt,
          now: clock(atExpiry + clockSkewMs + 1),
        }),
      "expired_challenge",
      AUTH_TIMING_REASONS.expired,
    );
  });

  it("uses a controllable clock when creating challenge timestamps", () => {
    expect(createAuthChallengeTiming({ lifetimeMs, now: clock() })).toEqual({
      issuedAt: "2026-07-22T12:00:00.000Z",
      expiresAt: "2026-07-22T12:05:00.000Z",
    });
  });

  it("loads and validates environment-backed duration configuration", () => {
    expect(
      getAuthChallengeConfig({
        STEALTH_AUTH_CHALLENGE_LIFETIME_MS: "60000",
        STEALTH_AUTH_CLOCK_SKEW_MS: "5000",
      }),
    ).toEqual({ lifetimeMs: 60_000, clockSkewMs: 5_000 });
    expect(() => getAuthChallengeConfig({ STEALTH_AUTH_CHALLENGE_LIFETIME_MS: "0" })).toThrow(
      /STEALTH_AUTH_CHALLENGE_LIFETIME_MS/,
    );
    expect(() => getAuthChallengeConfig({ STEALTH_AUTH_CLOCK_SKEW_MS: "-1" })).toThrow(
      /STEALTH_AUTH_CLOCK_SKEW_MS/,
    );
  });
});
