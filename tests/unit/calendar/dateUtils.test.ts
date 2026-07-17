import { describe, it, expect } from "vitest";
import {
  getReferenceNow,
  getAppToday,
  getLocalTimeZone,
} from "../../../src/features/calendar/dateUtils";
import { startOfDay } from "date-fns";

describe("dateUtils", () => {
  it("getReferenceNow returns the fixed seed time", () => {
    const now = getReferenceNow();
    expect(now).toEqual(new Date(2026, 5, 13, 9, 41, 0, 0));
  });

  it("getAppToday returns the start of the reference day", () => {
    const today = getAppToday();
    expect(today).toEqual(startOfDay(new Date(2026, 5, 13, 9, 41, 0, 0)));
  });

  it("getLocalTimeZone returns a timezone string", () => {
    const tz = getLocalTimeZone();
    expect(typeof tz).toBe("string");
  });

  it("getLocalTimeZone fallback when Intl fails", () => {
    const originalIntl = global.Intl;
    // Replace Intl with undefined to trigger the catch block
    Object.defineProperty(global, "Intl", { value: undefined, writable: true, configurable: true });

    expect(getLocalTimeZone()).toBe("local time");

    // Restore Intl
    Object.defineProperty(global, "Intl", {
      value: originalIntl,
      writable: true,
      configurable: true,
    });
  });
});
