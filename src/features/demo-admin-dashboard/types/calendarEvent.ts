import type { DemoCalendarEvent } from "./dataset";

export type CalendarResponseState = "needsAction" | "accepted" | "declined" | "tentative";

export interface CalendarResponseStateOption {
  state: CalendarResponseState;
  label: string;
  description: string;
}

export const CALENDAR_RESPONSE_STATES: CalendarResponseState[] = [
  "needsAction",
  "accepted",
  "declined",
  "tentative",
];

export const CALENDAR_RESPONSE_STATE_OPTIONS: Record<
  CalendarResponseState,
  CalendarResponseStateOption
> = {
  needsAction: {
    state: "needsAction",
    label: "Needs action",
    description: "The recipient has not yet responded to the invitation.",
  },
  accepted: {
    state: "accepted",
    label: "Accepted",
    description: "The recipient accepted the invitation.",
  },
  declined: {
    state: "declined",
    label: "Declined",
    description: "The recipient declined the invitation.",
  },
  tentative: {
    state: "tentative",
    label: "Tentative",
    description: "The recipient tentatively accepted the invitation.",
  },
};

export const DEFAULT_RESPONSE_STATE: CalendarResponseState = "needsAction";

export function getResponseStateOption(state: CalendarResponseState): CalendarResponseStateOption {
  return CALENDAR_RESPONSE_STATE_OPTIONS[state];
}

export interface CalendarEventEditorState {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  location: string;
  attendees: string[];
  responseState: CalendarResponseState;
}

export function calendarEventToEditorState(event: DemoCalendarEvent): CalendarEventEditorState {
  return {
    id: event.id,
    title: event.title,
    startTime: event.startTime,
    endTime: event.endTime,
    location: event.location ?? "",
    attendees: [...event.attendees],
    responseState: "needsAction",
  };
}

export function editorStateToCalendarEvent(state: CalendarEventEditorState): DemoCalendarEvent {
  return {
    id: state.id,
    title: state.title,
    startTime: state.startTime,
    endTime: state.endTime,
    location: state.location || undefined,
    attendees: state.attendees,
  };
}
