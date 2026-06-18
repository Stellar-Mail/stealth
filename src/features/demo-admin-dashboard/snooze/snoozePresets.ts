import {
  addDays,
  addHours,
  nextMonday,
  nextSaturday,
  setHours,
  setMinutes,
  setSeconds,
  startOfDay,
} from "date-fns";
import { getDemoNow } from "./referenceNow";
import type { SnoozePresetId } from "./types";

export interface SnoozePreset {
  id: SnoozePresetId;
  label: string;
  /** Pure given `now`, so presets are deterministic and testable. */
  resolve: (now: Date) => Date;
}

const at = (day: Date, hour: number, minute = 0) =>
  setSeconds(setMinutes(setHours(startOfDay(day), hour), minute), 0);

export const SNOOZE_PRESETS: SnoozePreset[] = [
  {
    id: "later-today",
    label: "Later today",
    // A few hours out, but never past the evening; if it's already evening,
    // just add three hours.
    resolve: (now) => {
      const evening = at(now, 18);
      const plusThree = addHours(now, 3);
      if (now.getTime() >= evening.getTime()) return plusThree;
      return plusThree.getTime() > evening.getTime() ? evening : plusThree;
    },
  },
  { id: "tomorrow", label: "Tomorrow", resolve: (now) => at(addDays(now, 1), 9) },
  { id: "this-weekend", label: "This weekend", resolve: (now) => at(nextSaturday(now), 9) },
  { id: "next-week", label: "Next week", resolve: (now) => at(nextMonday(now), 9) },
];

export function getSnoozePreset(id: SnoozePresetId): SnoozePreset {
  return SNOOZE_PRESETS.find((preset) => preset.id === id) ?? SNOOZE_PRESETS[0];
}

/** Resolve a preset against the demo clock (or a supplied `now`). */
export function resolvePreset(id: SnoozePresetId, now: Date = getDemoNow()): Date {
  return getSnoozePreset(id).resolve(now);
}
