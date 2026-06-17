import { describe, expect, it } from "vitest";
import { format } from "date-fns";

import { getReferenceNow } from "../../../src/features/calendar/dateUtils";
import type { CalendarEvent } from "../../../src/features/calendar/types";
import {
  SNOOZE_PRESETS,
  buildSnoozeState,
  findSnoozeConflicts,
  formatSnoozeSummary,
  isSnoozeDue,
  snoozePatch,
  unsnoozePatch,
  validateCustomSnooze,
} from "../../../src/features/snooze/types";

const now = getReferenceNow(); // 2026-06-13 09:41 (Saturday)

const resolve = (id: string) => SNOOZE_PRESETS.find((preset) => preset.id === id)!.resolve(now);

const event = (over: Partial<CalendarEvent>): CalendarEvent => ({
  id: "e1",
  title: "Sync",
  date: "2026-06-13",
  time: "12:00",
  endTime: "12:30",
  location: "",
  note: "",
  calendarId: "work",
  cadence: "One time",
  response: "going",
  reminder: "15 minutes",
  ...over,
});

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------
describe("SNOOZE_PRESETS", () => {
  it("offers later today, tomorrow, and next week", () => {
    expect(SNOOZE_PRESETS.map((p) => p.id)).toEqual(["later-today", "tomorrow", "next-week"]);
  });

  it("resolves 'tomorrow' to 9:00 AM the next day", () => {
    expect(format(resolve("tomorrow"), "yyyy-MM-dd HH:mm")).toBe("2026-06-14 09:00");
  });

  it("resolves 'next-week' to the next Monday at 9:00 AM", () => {
    expect(format(resolve("next-week"), "yyyy-MM-dd HH:mm")).toBe("2026-06-15 09:00");
  });

  it("keeps 'later today' on the same day and in the future", () => {
    const later = resolve("later-today");
    expect(format(later, "yyyy-MM-dd")).toBe("2026-06-13");
    expect(later.getTime()).toBeGreaterThan(now.getTime());
  });
});

// ---------------------------------------------------------------------------
// Custom validation (past-date + timezone-local parsing)
// ---------------------------------------------------------------------------
describe("validateCustomSnooze", () => {
  it("rejects a past date", () => {
    const result = validateCustomSnooze("2026-06-12", "08:00", now);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/future/i);
  });

  it("rejects missing date or time", () => {
    expect(validateCustomSnooze("", "08:00", now).ok).toBe(false);
    expect(validateCustomSnooze("2026-06-20", "", now).ok).toBe(false);
  });

  it("accepts a valid future moment", () => {
    const result = validateCustomSnooze("2026-06-20", "14:30", now);
    expect(result.ok).toBe(true);
    if (result.ok) expect(format(result.remindAt, "yyyy-MM-dd HH:mm")).toBe("2026-06-20 14:30");
  });
});

// ---------------------------------------------------------------------------
// Calendar conflicts
// ---------------------------------------------------------------------------
describe("findSnoozeConflicts", () => {
  it("flags same-day events within the window", () => {
    const remindAt = new Date("2026-06-13T12:30:00");
    const conflicts = findSnoozeConflicts(remindAt, [
      event({ id: "near", time: "12:00" }),
      event({ id: "far", time: "18:00" }),
      event({ id: "other-day", date: "2026-06-14", time: "12:15" }),
    ]);
    expect(conflicts.map((c) => c.id)).toEqual(["near"]);
  });
});

// ---------------------------------------------------------------------------
// State + patches
// ---------------------------------------------------------------------------
describe("snooze state and patches", () => {
  it("builds a reminder and a snooze patch", () => {
    const state = buildSnoozeState("tomorrow", resolve("tomorrow"), now);
    expect(state.choice).toBe("tomorrow");
    expect(state.label).toBe("Tomorrow");

    const patch = snoozePatch(state);
    expect(patch.folder).toBe("snoozed");
    expect(patch.time).toBe("Tomorrow");
    expect(patch.snooze).toBe(state);
  });

  it("undo returns the message to the inbox and clears the reminder", () => {
    const patch = unsnoozePatch();
    expect(patch.folder).toBe("inbox");
    expect(patch.snooze).toBeUndefined();
  });

  it("summarizes and detects due reminders", () => {
    const state = buildSnoozeState("tomorrow", resolve("tomorrow"), now);
    expect(formatSnoozeSummary(state, now)).toMatch(/Returns Tomorrow at 9:00 AM/);
    expect(isSnoozeDue(state, now)).toBe(false);

    const past = buildSnoozeState("custom", new Date("2026-06-13T08:00:00"), now);
    expect(isSnoozeDue(past, now)).toBe(true);
  });
});
