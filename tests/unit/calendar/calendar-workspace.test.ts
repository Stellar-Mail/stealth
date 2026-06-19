import { describe, expect, it } from "vitest";

import {
  filterVisibleCalendarEvents,
  getDisplayedCalendarEvents,
} from "../../../src/features/calendar/components/CalendarWorkspace";
import { getEventMailCardStatusLabel } from "../../../src/features/calendar/components/EventMailCard";
import { getAppToday, getReferenceNow } from "../../../src/features/calendar/dateUtils";
import type {
  CalendarDefinition,
  CalendarEvent,
  MailEvent,
} from "../../../src/features/calendar/types";
import { mailEventToCalendarDraft } from "../../../src/features/calendar/useCalendar";

const calendars: CalendarDefinition[] = [
  { id: "work", name: "Work", color: "#8fa8ff", visible: true },
  { id: "personal", name: "Personal", color: "#d5d7dc", visible: true },
  { id: "hidden", name: "Hidden", color: "#f2b880", visible: false },
];

const calendarEvent = (overrides: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: "event-work-review",
  title: "Design review",
  date: "2026-06-13",
  time: "10:00",
  endTime: "10:45",
  location: "Vantage studio",
  note: "Approve final identity direction.",
  calendarId: "work",
  cadence: "One time",
  response: "going",
  reminder: "15 minutes",
  ...overrides,
});

const mailEvent = (overrides: Partial<MailEvent> = {}): MailEvent => ({
  id: "mail-investor-sync",
  title: "Investor sync",
  month: "Jun",
  day: "16",
  cadence: "Monthly",
  date: "2026-06-16",
  time: "1:15 PM",
  location: "Lumos Capital",
  note: "Join briefing",
  calendar: "protocol",
  organizer: "Uthaimin Lawal",
  meetingUrl: "https://meet.stealth.local/investor-sync",
  days: [
    { label: "Mon", date: "15" },
    { label: "Tue", date: "16", active: true },
  ],
  ...overrides,
});

describe("calendar reference clock", () => {
  it("uses the deterministic seed timestamp and day boundary", () => {
    const now = getReferenceNow();
    expect([
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      now.getHours(),
      now.getMinutes(),
    ]).toEqual([2026, 5, 13, 9, 41]);

    const today = getAppToday();
    expect([today.getFullYear(), today.getMonth(), today.getDate()]).toEqual([2026, 5, 13]);
    expect([today.getHours(), today.getMinutes(), today.getSeconds()]).toEqual([0, 0, 0]);
  });
});

describe("mailEventToCalendarDraft", () => {
  it("builds a saved calendar draft from a mail event", () => {
    const draft = mailEventToCalendarDraft(mailEvent(), "email-investor-sync");

    expect(draft).toMatchObject({
      title: "Investor sync",
      date: "2026-06-16",
      time: "13:15",
      endTime: "14:15",
      location: "Lumos Capital",
      calendarId: "protocol",
      organizer: "Uthaimin Lawal",
      meetingUrl: "https://meet.stealth.local/investor-sync",
      sourceEmailId: "email-investor-sync",
      response: "going",
      reminder: "15 minutes",
    });
    expect(draft.id).toBeUndefined();
  });

  it("falls back to deterministic defaults for missing date, calendar, and malformed time", () => {
    const draft = mailEventToCalendarDraft(
      mailEvent({ date: undefined, time: "after lunch", calendar: undefined }),
      "email-missing-time",
    );

    expect(draft.date).toBe("2026-06-13");
    expect(draft.time).toBe("09:00");
    expect(draft.endTime).toBe("10:00");
    expect(draft.calendarId).toBe("personal");
  });
});

describe("CalendarWorkspace event filtering", () => {
  const events: CalendarEvent[] = [
    calendarEvent({ id: "work-today", calendarId: "work", date: "2026-06-13" }),
    calendarEvent({ id: "hidden-today", calendarId: "hidden", date: "2026-06-13" }),
    calendarEvent({ id: "personal-next-day", calendarId: "personal", date: "2026-06-14" }),
    calendarEvent({ id: "work-next-month", calendarId: "work", date: "2026-07-01" }),
  ];

  it("shows visible-calendar events for the selected agenda day", () => {
    const displayed = getDisplayedCalendarEvents({
      calendars,
      events,
      selectedDate: new Date(2026, 5, 13),
      month: new Date(2026, 5, 1),
      view: "agenda",
    });

    expect(displayed.map((event) => event.id)).toEqual(["work-today"]);
  });

  it("excludes hidden calendars from month and visible event collections", () => {
    expect(filterVisibleCalendarEvents(calendars, events).map((event) => event.id)).toEqual([
      "work-today",
      "personal-next-day",
      "work-next-month",
    ]);

    const displayed = getDisplayedCalendarEvents({
      calendars,
      events,
      selectedDate: new Date(2026, 5, 13),
      month: new Date(2026, 5, 1),
      view: "month",
    });

    expect(displayed.map((event) => event.id)).toEqual(["work-today", "personal-next-day"]);
  });
});

describe("EventMailCard status label", () => {
  it("returns the user-visible label for unsaved and saved event cards", () => {
    expect(getEventMailCardStatusLabel(null)).toBe("Upcoming event");
    expect(getEventMailCardStatusLabel(calendarEvent())).toBe("Added to calendar");
  });
});
