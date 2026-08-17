import { describe, expect, it } from "vitest";
import {
  CalendarEventEditor,
  prepareAttendees,
  formatAttendeesDisplay,
} from "../components/CalendarEventEditor";

describe("CalendarEventEditor module", () => {
  it("exports the CalendarEventEditor component", () => {
    expect(CalendarEventEditor).toBeDefined();
    expect(typeof CalendarEventEditor).toBe("function");
  });

  it("exports prepareAttendees helper", () => {
    expect(prepareAttendees).toBeDefined();
    expect(typeof prepareAttendees).toBe("function");
  });

  it("exports formatAttendeesDisplay helper", () => {
    expect(formatAttendeesDisplay).toBeDefined();
    expect(typeof formatAttendeesDisplay).toBe("function");
  });
});

describe("prepareAttendees", () => {
  it("returns an empty array for empty input", () => {
    expect(prepareAttendees("")).toEqual([]);
  });

  it("returns an empty array for whitespace-only input", () => {
    expect(prepareAttendees("   ")).toEqual([]);
  });

  it("parses a single attendee", () => {
    expect(prepareAttendees("eve@stealth.xyz")).toEqual(["eve@stealth.xyz"]);
  });

  it("parses multiple comma-separated attendees", () => {
    expect(prepareAttendees("eve@stealth.xyz, lina@vantage.studio")).toEqual([
      "eve@stealth.xyz",
      "lina@vantage.studio",
    ]);
  });

  it("trims whitespace around attendees", () => {
    expect(prepareAttendees("  eve@stealth.xyz  ,  lina@vantage.studio  ")).toEqual([
      "eve@stealth.xyz",
      "lina@vantage.studio",
    ]);
  });

  it("filters out empty entries from trailing commas", () => {
    expect(prepareAttendees("eve@stealth.xyz, ")).toEqual(["eve@stealth.xyz"]);
  });
});

describe("formatAttendeesDisplay", () => {
  it("returns empty string for empty array", () => {
    expect(formatAttendeesDisplay([])).toBe("");
  });

  it("returns a single attendee unchanged", () => {
    expect(formatAttendeesDisplay(["eve@stealth.xyz"])).toBe("eve@stealth.xyz");
  });

  it("joins multiple attendees with comma and space", () => {
    expect(formatAttendeesDisplay(["eve@stealth.xyz", "lina@vantage.studio"])).toBe(
      "eve@stealth.xyz, lina@vantage.studio",
    );
  });

  it("round-trips with prepareAttendees", () => {
    const input = "eve@stealth.xyz, lina@vantage.studio";
    const parsed = prepareAttendees(input);
    const formatted = formatAttendeesDisplay(parsed);
    expect(prepareAttendees(formatted)).toEqual(parsed);
  });
});
