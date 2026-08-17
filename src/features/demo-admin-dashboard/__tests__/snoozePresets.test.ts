import { describe, expect, it } from "vitest";
import { getDemoNow } from "../snooze/referenceNow";
import { SNOOZE_PRESETS, resolvePreset } from "../snooze/snoozePresets";
import { toLocalStamp } from "../snooze/snoozeValidation";

const now = getDemoNow(); // 2026-06-16T09:00 (Tuesday)

describe("SNOOZE_PRESETS", () => {
  it("offers later today, tomorrow, this weekend, and next week", () => {
    expect(SNOOZE_PRESETS.map((p) => p.id)).toEqual([
      "later-today",
      "tomorrow",
      "this-weekend",
      "next-week",
    ]);
  });

  it("resolves tomorrow to 9:00 AM the next day", () => {
    expect(toLocalStamp(resolvePreset("tomorrow", now))).toBe("2026-06-17T09:00");
  });

  it("resolves this weekend to the next Saturday at 9:00 AM", () => {
    expect(toLocalStamp(resolvePreset("this-weekend", now))).toBe("2026-06-20T09:00");
  });

  it("resolves next week to the next Monday at 9:00 AM", () => {
    expect(toLocalStamp(resolvePreset("next-week", now))).toBe("2026-06-22T09:00");
  });

  it("keeps later today on the same day and in the future", () => {
    const later = resolvePreset("later-today", now);
    expect(toLocalStamp(later).startsWith("2026-06-16")).toBe(true);
    expect(later.getTime()).toBeGreaterThan(now.getTime());
  });
});
