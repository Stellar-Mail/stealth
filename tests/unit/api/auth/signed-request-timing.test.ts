import { afterEach, describe, expect, it } from "vitest";

import { AUTH_TIMING_REASONS } from "../../../../src/server/api/auth/challenge";
import {
  SIGNED_REQUEST_CLOCK_SKEW_MS,
  SIGNED_REQUEST_MAX_AGE_MS,
  signedRequestTimeStatus,
  signedRequestTimingReason,
} from "../../../../src/server/api/auth/signed-request";

const NOW = Date.parse("2026-07-22T12:00:00.000Z");
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

const ENV_KEYS = ["STEALTH_AUTH_CHALLENGE_LIFETIME_MS", "STEALTH_AUTH_CLOCK_SKEW_MS"] as const;

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});

describe("signed request validity window", () => {
  it("shares the protocol defaults with the challenge policy", () => {
    expect(SIGNED_REQUEST_MAX_AGE_MS).toBe(5 * 60 * 1000);
    expect(SIGNED_REQUEST_CLOCK_SKEW_MS).toBe(30 * 1000);
  });

  it("accepts both exact boundaries and rejects one millisecond beyond each", () => {
    expect(signedRequestTimeStatus(at(SIGNED_REQUEST_CLOCK_SKEW_MS), NOW)).toBe("valid");
    expect(signedRequestTimeStatus(at(SIGNED_REQUEST_CLOCK_SKEW_MS + 1), NOW)).toBe("future");

    const oldest = -(SIGNED_REQUEST_MAX_AGE_MS + SIGNED_REQUEST_CLOCK_SKEW_MS);
    expect(signedRequestTimeStatus(at(oldest), NOW)).toBe("valid");
    expect(signedRequestTimeStatus(at(oldest - 1), NOW)).toBe("expired");
  });

  it("rejects an unparseable timestamp without treating it as a timing failure", () => {
    expect(signedRequestTimeStatus("not-a-date", NOW)).toBe("invalid");
    expect(signedRequestTimingReason("invalid")).toBeNull();
    expect(signedRequestTimingReason("valid")).toBeNull();
  });

  it("maps timing failures to stable machine-readable reasons", () => {
    expect(signedRequestTimingReason("expired")).toBe(AUTH_TIMING_REASONS.expired);
    expect(signedRequestTimingReason("future")).toBe(AUTH_TIMING_REASONS.notYetValid);
  });

  it("applies the deployment-configured window instead of the defaults", () => {
    process.env.STEALTH_AUTH_CHALLENGE_LIFETIME_MS = "60000";
    process.env.STEALTH_AUTH_CLOCK_SKEW_MS = "5000";

    // Inside the default window but outside the configured one.
    expect(signedRequestTimeStatus(at(-120_000), NOW)).toBe("expired");
    expect(signedRequestTimeStatus(at(10_000), NOW)).toBe("future");

    expect(signedRequestTimeStatus(at(-65_000), NOW)).toBe("valid");
    expect(signedRequestTimeStatus(at(5_000), NOW)).toBe("valid");
  });

  it("lets explicit arguments override the configured window", () => {
    process.env.STEALTH_AUTH_CHALLENGE_LIFETIME_MS = "60000";
    process.env.STEALTH_AUTH_CLOCK_SKEW_MS = "5000";

    expect(signedRequestTimeStatus(at(-120_000), NOW, 5 * 60 * 1000, 30 * 1000)).toBe("valid");
  });
});
