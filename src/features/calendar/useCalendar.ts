import { useEffect, useMemo, useState } from "react";
import { defaultCalendarEvents, defaultCalendars } from "./data";
import type {
  CalendarDefinition,
  CalendarEvent,
  CalendarEventDraft,
  CalendarResponse,
  MailEvent,
} from "./types";

const STORAGE_KEY = "stealth-calendar-v1";

type CalendarSnapshot = {
  calendars: CalendarDefinition[];
  events: CalendarEvent[];
};

function loadCalendar(): CalendarSnapshot {
  if (typeof window === "undefined") {
    return { calendars: defaultCalendars, events: defaultCalendarEvents };
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return { calendars: defaultCalendars, events: defaultCalendarEvents };
    const parsed = JSON.parse(stored) as CalendarSnapshot;
    return {
      calendars: parsed.calendars?.length ? parsed.calendars : defaultCalendars,
      events: parsed.events?.length ? parsed.events : defaultCalendarEvents,
    };
  } catch {
    return { calendars: defaultCalendars, events: defaultCalendarEvents };
  }
}

export function useCalendar() {
  const [snapshot, setSnapshot] = useState<CalendarSnapshot>(loadCalendar);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  }, [snapshot]);

  const visibleCalendarIds = useMemo(
    () =>
      new Set(
        snapshot.calendars.filter((calendar) => calendar.visible).map((calendar) => calendar.id),
      ),
    [snapshot.calendars],
  );

  const visibleEvents = useMemo(
    () =>
      snapshot.events
        .filter((event) => visibleCalendarIds.has(event.calendarId))
        .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)),
    [snapshot.events, visibleCalendarIds],
  );

  const saveEvent = (draft: CalendarEventDraft) => {
    const id = draft.id ?? `calendar-${Date.now()}`;
    const event: CalendarEvent = { ...draft, id };
    setSnapshot((current) => ({
      ...current,
      events: current.events.some((item) => item.id === id)
        ? current.events.map((item) => (item.id === id ? event : item))
        : [...current.events, event],
    }));
    return event;
  };

  const addMailEvent = (mailEvent: MailEvent, sourceEmailId: string) => {
    const existing = snapshot.events.find((event) => event.sourceEmailId === sourceEmailId);
    if (existing) return existing;

    return saveEvent({
      title: mailEvent.title,
      date: mailEvent.date ?? "2026-06-13",
      time: to24HourTime(mailEvent.time),
      endTime: mailEvent.endTime ?? addOneHour(to24HourTime(mailEvent.time)),
      location: mailEvent.location,
      note: mailEvent.note,
      calendarId: mailEvent.calendar ?? "personal",
      cadence: mailEvent.cadence,
      organizer: mailEvent.organizer,
      meetingUrl: mailEvent.meetingUrl,
      sourceEmailId,
      response: "going",
      reminder: "15 minutes",
    });
  };

  const deleteEvent = (id: string) => {
    setSnapshot((current) => ({
      ...current,
      events: current.events.filter((event) => event.id !== id),
    }));
  };

  const duplicateEvent = (id: string) => {
    const source = snapshot.events.find((event) => event.id === id);
    if (!source) return null;
    return saveEvent({
      ...source,
      id: undefined,
      title: `${source.title} copy`,
      sourceEmailId: undefined,
    });
  };

  const updateResponse = (id: string, response: CalendarResponse) => {
    setSnapshot((current) => ({
      ...current,
      events: current.events.map((event) => (event.id === id ? { ...event, response } : event)),
    }));
  };

  const updateReminder = (id: string, reminder: string) => {
    setSnapshot((current) => ({
      ...current,
      events: current.events.map((event) => (event.id === id ? { ...event, reminder } : event)),
    }));
  };

  const toggleCalendar = (id: string) => {
    setSnapshot((current) => ({
      ...current,
      calendars: current.calendars.map((calendar) =>
        calendar.id === id ? { ...calendar, visible: !calendar.visible } : calendar,
      ),
    }));
  };

  const addCalendar = (calendar: Omit<CalendarDefinition, "id" | "visible">) => {
    const next: CalendarDefinition = {
      ...calendar,
      id: `calendar-list-${Date.now()}`,
      visible: true,
    };
    setSnapshot((current) => ({ ...current, calendars: [...current.calendars, next] }));
    return next;
  };

  return {
    calendars: snapshot.calendars,
    events: snapshot.events,
    visibleEvents,
    saveEvent,
    addMailEvent,
    deleteEvent,
    duplicateEvent,
    updateResponse,
    updateReminder,
    toggleCalendar,
    addCalendar,
  };
}

export function to24HourTime(value: string) {
  const match = value.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return "09:00";
  let hour = Number(match[1]);
  if (match[3]?.toUpperCase() === "PM" && hour < 12) hour += 12;
  if (match[3]?.toUpperCase() === "AM" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${match[2]}`;
}

export function addOneHour(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return `${String((hours + 1) % 24).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
