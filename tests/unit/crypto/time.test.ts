import { describe, expect, it } from "vitest";

import {
  parseUtcTimestamp,
  TimestampError,
  validateTimestamp,
  type Clock,
} from "../../../src/services/crypto/time";

const ANCHOR = new Date("2026-07-23T12:00:00.000Z");

function fixedClock(): Clock {
  return { now: () => new Date(ANCHOR) };
}

describe("envelope timestamp validation (#1710)", () => {
  it("accepts a well-formed UTC timestamp within bounds", () => {
    const ts = "2026-07-23T11:59:00.000Z";
    const date = validateTimestamp(ts, {
      maxAgeMs: 60_000,
      maxFutureSkewMs: 60_000,
      clock: fixedClock(),
    });
    expect(date.getTime()).toBe(Date.parse("2026-07-23T11:59:00.000Z"));
  });

  it("rejects empty timestamps", () => {
    expect(() =>
      validateTimestamp("  ", { maxAgeMs: 60_000, maxFutureSkewMs: 60_000, clock: fixedClock() }),
    ).toThrowError(TimestampError);
  });

  it("rejects non-UTC timestamps (no Z / non-zero offset)", () => {
    expect(() => parseUtcTimestamp("2026-07-23T12:00:00.000+02:00")).toThrowError(TimestampError);
    expect(() => parseUtcTimestamp("2026-07-23T12:00:00")).toThrowError(TimestampError);
  });

  it("accepts a +00:00 offset as UTC", () => {
    const date = parseUtcTimestamp("2026-07-23T12:00:00.000+00:00");
    expect(date.getTime()).toBe(Date.parse("2026-07-23T12:00:00.000Z"));
  });

  it("rejects unparseable timestamps", () => {
    expect(() => parseUtcTimestamp("not-a-dateZ")).toThrowError(TimestampError);
  });

  it("rejects timestamps older than maxAge (boundary exclusive)", () => {
    const ts = "2026-07-23T11:58:59.000Z"; // 61s before anchor
    expect(() =>
      validateTimestamp(ts, { maxAgeMs: 60_000, maxFutureSkewMs: 0, clock: fixedClock() }),
    ).toThrowError(TimestampError);
  });

  it("allows a timestamp exactly at the maxAge boundary", () => {
    const ts = "2026-07-23T11:59:00.000Z"; // exactly 60s before anchor
    const date = validateTimestamp(ts, {
      maxAgeMs: 60_000,
      maxFutureSkewMs: 0,
      clock: fixedClock(),
    });
    expect(date).toBeInstanceOf(Date);
  });

  it("rejects timestamps further in the future than maxFutureSkew", () => {
    const ts = "2026-07-23T12:01:01.000Z"; // 61s after anchor
    expect(() =>
      validateTimestamp(ts, { maxAgeMs: 0, maxFutureSkewMs: 60_000, clock: fixedClock() }),
    ).toThrowError(TimestampError);
  });

  it("allows a timestamp exactly at the future-skew boundary", () => {
    const ts = "2026-07-23T12:01:00.000Z"; // exactly 60s after anchor
    const date = validateTimestamp(ts, {
      maxAgeMs: 0,
      maxFutureSkewMs: 60_000,
      clock: fixedClock(),
    });
    expect(date).toBeInstanceOf(Date);
  });
});
