import { describe, expect, it } from "vitest";
import {
  calendarEventToEditorState,
  editorStateToCalendarEvent,
  getResponseStateOption,
  CALENDAR_RESPONSE_STATES,
  CALENDAR_RESPONSE_STATE_OPTIONS,
  DEFAULT_RESPONSE_STATE,
} from "../types/calendarEvent";
import type { DemoCalendarEvent } from "../types/dataset";

describe("calendarEventToEditorState", () => {
  it("converts a DemoCalendarEvent to editor state", () => {
    const event: DemoCalendarEvent = {
      id: "evt-test",
      title: "Test Event",
      startTime: "2026-06-23T09:00",
      endTime: "2026-06-23T10:00",
      location: "Room 1",
      attendees: ["eve@stealth.xyz"],
    };

    const state = calendarEventToEditorState(event);
    expect(state.id).toBe("evt-test");
    expect(state.title).toBe("Test Event");
    expect(state.startTime).toBe("2026-06-23T09:00");
    expect(state.endTime).toBe("2026-06-23T10:00");
    expect(state.location).toBe("Room 1");
    expect(state.attendees).toEqual(["eve@stealth.xyz"]);
    expect(state.responseState).toBe("needsAction");
  });

  it("handles missing location", () => {
    const event: DemoCalendarEvent = {
      id: "evt-no-loc",
      title: "No Location",
      startTime: "2026-06-23T09:00",
      endTime: "2026-06-23T10:00",
      attendees: [],
    };

    const state = calendarEventToEditorState(event);
    expect(state.location).toBe("");
  });

  it("copies attendees array (does not share reference)", () => {
    const attendees = ["eve@stealth.xyz"];
    const event: DemoCalendarEvent = {
      id: "evt-ref",
      title: "Ref Test",
      startTime: "2026-06-23T09:00",
      endTime: "2026-06-23T10:00",
      attendees,
    };

    const state = calendarEventToEditorState(event);
    state.attendees.push("lina@vantage.studio");
    expect(event.attendees).toHaveLength(1);
    expect(state.attendees).toHaveLength(2);
  });
});

describe("editorStateToCalendarEvent", () => {
  it("converts editor state back to DemoCalendarEvent", () => {
    const state = {
      id: "evt-roundtrip",
      title: "Roundtrip Event",
      startTime: "2026-06-23T09:00",
      endTime: "2026-06-23T10:00",
      location: "Room 2",
      attendees: ["eve@stealth.xyz"],
      responseState: "accepted" as const,
    };

    const event = editorStateToCalendarEvent(state);
    expect(event.id).toBe("evt-roundtrip");
    expect(event.title).toBe("Roundtrip Event");
    expect(event.startTime).toBe("2026-06-23T09:00");
    expect(event.endTime).toBe("2026-06-23T10:00");
    expect(event.location).toBe("Room 2");
    expect(event.attendees).toEqual(["eve@stealth.xyz"]);
  });

  it("strips empty location to undefined", () => {
    const state = {
      id: "evt-no-loc",
      title: "No Location",
      startTime: "2026-06-23T09:00",
      endTime: "2026-06-23T10:00",
      location: "",
      attendees: [],
      responseState: "needsAction" as const,
    };

    const event = editorStateToCalendarEvent(state);
    expect(event.location).toBeUndefined();
  });

  it("round-trips with calendarEventToEditorState", () => {
    const original: DemoCalendarEvent = {
      id: "evt-rt",
      title: "Round Trip",
      startTime: "2026-06-23T14:00",
      endTime: "2026-06-23T15:00",
      location: "Virtual",
      attendees: ["alice@example.com", "bob@example.org"],
    };

    const editorState = calendarEventToEditorState(original);
    const restored = editorStateToCalendarEvent(editorState);

    expect(restored.id).toBe(original.id);
    expect(restored.title).toBe(original.title);
    expect(restored.startTime).toBe(original.startTime);
    expect(restored.endTime).toBe(original.endTime);
    expect(restored.location).toBe(original.location);
    expect(restored.attendees).toEqual(original.attendees);
  });
});

describe("CalendarResponseState constants", () => {
  it("defines all response states", () => {
    expect(CALENDAR_RESPONSE_STATES).toEqual(["needsAction", "accepted", "declined", "tentative"]);
  });

  it("has options for every state", () => {
    for (const state of CALENDAR_RESPONSE_STATES) {
      expect(CALENDAR_RESPONSE_STATE_OPTIONS[state]).toBeDefined();
      expect(CALENDAR_RESPONSE_STATE_OPTIONS[state].state).toBe(state);
    }
  });

  it("default response state is needsAction", () => {
    expect(DEFAULT_RESPONSE_STATE).toBe("needsAction");
  });

  it("getResponseStateOption returns the correct option", () => {
    const opt = getResponseStateOption("accepted");
    expect(opt.label).toBe("Accepted");
    expect(opt.description).toBe("The recipient accepted the invitation.");
  });
});

describe("calendarEventFixtures", () => {
  it("exports deterministic fixtures", async () => {
    const { calendarEventFixtures } = await import("../fixtures/calendarEventFixtures");
    expect(calendarEventFixtures.length).toBeGreaterThan(0);
    for (const evt of calendarEventFixtures) {
      expect(evt.id).toBeTruthy();
      expect(evt.title).toBeTruthy();
      expect(evt.startTime).toBeTruthy();
      expect(evt.endTime).toBeTruthy();
    }
  });

  it("exports defaultCalendarEvent", async () => {
    const { defaultCalendarEvent } = await import("../fixtures/calendarEventFixtures");
    expect(defaultCalendarEvent.id).toBe("evt-new");
    expect(defaultCalendarEvent.title).toBe("");
  });
});
