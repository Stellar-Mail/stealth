import { describe, it, expect } from "vitest";
import { to24HourTime, addOneHour } from "../../../src/features/calendar/useCalendar";

describe("useCalendar pure helpers", () => {
  describe("to24HourTime", () => {
    it("parses AM times correctly", () => {
      expect(to24HourTime("9:30 AM")).toBe("09:30");
      expect(to24HourTime("11:00 AM")).toBe("11:00");
    });

    it("parses PM times correctly", () => {
      expect(to24HourTime("2:15 PM")).toBe("14:15");
      expect(to24HourTime("11:59 PM")).toBe("23:59");
    });

    it("handles 12 AM and 12 PM correctly", () => {
      expect(to24HourTime("12:00 AM")).toBe("00:00");
      expect(to24HourTime("12:30 PM")).toBe("12:30");
    });

    it("parses 24-hour times without AM/PM", () => {
      expect(to24HourTime("14:00")).toBe("14:00");
      expect(to24HourTime("08:45")).toBe("08:45");
    });

    it("returns default 09:00 for invalid formats", () => {
      expect(to24HourTime("invalid time")).toBe("09:00");
      expect(to24HourTime("")).toBe("09:00");
    });
  });

  describe("addOneHour", () => {
    it("adds an hour to a standard morning time", () => {
      expect(addOneHour("09:30")).toBe("10:30");
    });

    it("adds an hour and wraps around midnight correctly", () => {
      expect(addOneHour("23:15")).toBe("00:15");
    });

    it("handles single digit hours padded with zero", () => {
      expect(addOneHour("08:05")).toBe("09:05");
    });
  });
});
