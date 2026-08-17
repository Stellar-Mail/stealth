import { format, isSameDay, addDays } from "date-fns";
import { getDemoNow } from "./referenceNow";
import { getSnoozePreset, resolvePreset } from "./snoozePresets";
import type { SnoozeChoice, SnoozeMetadata, SnoozePresetId } from "./types";

/** Local, timezone-independent stamp stored in `SnoozeMetadata.remindAt`. */
export function toLocalStamp(date: Date): string {
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

export type CustomSnoozeValidation = { ok: true; remindAt: Date } | { ok: false; error: string };

/**
 * Validate a custom date + time. Inputs are interpreted in local time; rejects
 * missing, malformed, and past-or-now values.
 */
export function validateCustomSnooze(
  date: string,
  time: string,
  now: Date = getDemoNow(),
): CustomSnoozeValidation {
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

/** Short relative day label, e.g. "Today", "Tomorrow", or "Sat, Jun 20". */
export function relativeDayLabel(remindAt: Date, now: Date = getDemoNow()): string {
  if (isSameDay(remindAt, now)) return "Today";
  if (isSameDay(remindAt, addDays(now, 1))) return "Tomorrow";
  return format(remindAt, "EEE, MMM d");
}

/** Full, unambiguous reminder summary, e.g. "Returns Tomorrow at 9:00 AM". */
export function formatRemindAt(remindAt: Date, now: Date = getDemoNow()): string {
  return `Returns ${relativeDayLabel(remindAt, now)} at ${format(remindAt, "h:mm a")}`;
}

/** Build reminder metadata from a preset id. */
export function metadataFromPreset(id: SnoozePresetId, now: Date = getDemoNow()): SnoozeMetadata {
  const remindAt = resolvePreset(id, now);
  return { remindAt: toLocalStamp(remindAt), choice: id, label: getSnoozePreset(id).label };
}

/** Build reminder metadata from a validated custom date. */
export function metadataFromCustom(remindAt: Date, now: Date = getDemoNow()): SnoozeMetadata {
  return {
    remindAt: toLocalStamp(remindAt),
    choice: "custom" as SnoozeChoice,
    label: relativeDayLabel(remindAt, now),
  };
}
