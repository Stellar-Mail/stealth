import {
  addDays,
  addHours,
  format,
  isSameDay,
  nextMonday,
  parseISO,
  setHours,
  setMinutes,
  setSeconds,
  startOfDay,
} from "date-fns";
import { getReferenceNow } from "@/features/calendar";
import type { CalendarEvent } from "@/features/calendar";
import type { Email, SnoozeState } from "@/components/mail/data";

export type SnoozePresetId = "later-today" | "tomorrow" | "next-week";
export type SnoozeChoice = SnoozeState["choice"];

/** A one-tap snooze option. `resolve` is pure given `now`, so presets are testable. */
export type SnoozePreset = {
  id: SnoozePresetId;
  label: string;
  resolve: (now: Date) => Date;
};

const at = (day: Date, hour: number, minute = 0) =>
  setSeconds(setMinutes(setHours(startOfDay(day), hour), minute), 0);

export const SNOOZE_PRESETS: SnoozePreset[] = [
  {
    id: "later-today",
    label: "Later today",
    // A few hours out, but never past the evening — fall back to 6pm, and if
    // it's already evening, just add three hours.
    resolve: (now) => {
      const evening = at(now, 18);
      const threeHours = addHours(now, 3);
      if (now.getTime() >= evening.getTime()) return threeHours;
      return threeHours.getTime() > evening.getTime() ? evening : threeHours;
    },
  },
  {
    id: "tomorrow",
    label: "Tomorrow",
    resolve: (now) => at(addDays(now, 1), 9),
  },
  {
    id: "next-week",
    label: "Next week",
    resolve: (now) => at(nextMonday(now), 9),
  },
];

export function getSnoozePreset(id: SnoozePresetId): SnoozePreset {
  return SNOOZE_PRESETS.find((preset) => preset.id === id) ?? SNOOZE_PRESETS[0];
}

/** Short relative label shown on the email row / pill, e.g. "Tomorrow" or "Jun 22". */
export function shortLabel(remindAt: Date, now = getReferenceNow()): string {
  if (isSameDay(remindAt, now)) return "Later today";
  if (isSameDay(remindAt, addDays(now, 1))) return "Tomorrow";
  return format(remindAt, "MMM d");
}

/** Full, unambiguous reminder summary, e.g. "Returns Tomorrow at 9:00 AM". */
export function formatSnoozeSummary(state: SnoozeState, now = getReferenceNow()): string {
  const remindAt = parseISO(state.remindAt);
  return `Returns ${shortLabel(remindAt, now)} at ${format(remindAt, "h:mm a")}`;
}

/** True once the reminder time has passed relative to `now`. */
export function isSnoozeDue(state: SnoozeState, now = getReferenceNow()): boolean {
  return parseISO(state.remindAt).getTime() <= now.getTime();
}

export type SnoozeValidation = { ok: true; remindAt: Date } | { ok: false; error: string };

/**
 * Validate a custom date + time. Inputs are interpreted in the viewer's local
 * zone (the dialog shows which); rejects malformed and past-or-now values.
 */
export function validateCustomSnooze(
  date: string,
  time: string,
  now = getReferenceNow(),
): SnoozeValidation {
  if (!date) return { ok: false, error: "Pick a date for the reminder." };
  if (!time) return { ok: false, error: "Pick a time for the reminder." };

  const remindAt = new Date(`${date}T${time}`);
  if (Number.isNaN(remindAt.getTime())) {
    return { ok: false, error: "That date and time isn't valid." };
  }
  if (remindAt.getTime() <= now.getTime()) {
    return { ok: false, error: "Choose a moment in the future." };
  }
  return { ok: true, remindAt };
}

/**
 * Calendar events that sit close to a reminder. Same-day events within ±90
 * minutes are surfaced as conflicts so the user can pick a better time.
 */
export function findSnoozeConflicts(remindAt: Date, events: CalendarEvent[]): CalendarEvent[] {
  const windowMs = 90 * 60 * 1000;
  return events
    .filter((event) => {
      const start = new Date(`${event.date}T${event.time}`);
      if (Number.isNaN(start.getTime())) return false;
      return (
        isSameDay(start, remindAt) && Math.abs(start.getTime() - remindAt.getTime()) <= windowMs
      );
    })
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
}

/** Build the persisted reminder record. */
export function buildSnoozeState(
  choice: SnoozeChoice,
  remindAt: Date,
  now = getReferenceNow(),
): SnoozeState {
  const label = choice === "custom" ? shortLabel(remindAt, now) : getLabelForChoice(choice);
  return {
    remindAt: remindAt.toISOString(),
    choice,
    label,
    createdAt: now.toISOString(),
  };
}

function getLabelForChoice(choice: Exclude<SnoozeChoice, "custom">): string {
  return getSnoozePreset(choice).label;
}

/** Email patch that snoozes a message. */
export function snoozePatch(state: SnoozeState): Partial<Email> {
  return { folder: "snoozed", time: state.label, snooze: state };
}

/** Email patch that returns a snoozed message to the inbox (undo). */
export function unsnoozePatch(): Partial<Email> {
  return { folder: "inbox", time: "Now", snooze: undefined };
}
