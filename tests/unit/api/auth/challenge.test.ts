import { describe, expect, it } from "vitest";

import {
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

function expectCode(run: () => void, code: string) {
  try {
    run();
    throw new Error("Expected challenge validation to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe(code);
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
