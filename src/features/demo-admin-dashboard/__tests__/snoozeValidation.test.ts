import { describe, expect, it } from "vitest";
import { getDemoNow } from "../snooze/referenceNow";
import {
  formatRemindAt,
  metadataFromCustom,
  metadataFromPreset,
  relativeDayLabel,
  toLocalStamp,
  validateCustomSnooze,
} from "../snooze/snoozeValidation";

const now = getDemoNow(); // 2026-06-16T09:00

describe("validateCustomSnooze", () => {
  it("rejects a past date", () => {
    const result = validateCustomSnooze("2026-06-15", "08:00", now);
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
    if (result.ok) expect(toLocalStamp(result.remindAt)).toBe("2026-06-20T14:30");
  });
});

describe("formatting", () => {
  it("labels today and tomorrow relative to the demo clock", () => {
    expect(relativeDayLabel(new Date("2026-06-16T18:00"), now)).toBe("Today");
    expect(relativeDayLabel(new Date("2026-06-17T09:00"), now)).toBe("Tomorrow");
  });

  it("summarizes a reminder", () => {
    expect(formatRemindAt(new Date("2026-06-17T09:00"), now)).toBe("Returns Tomorrow at 9:00 AM");
  });
});

describe("metadata builders", () => {
  it("builds preset metadata with choice and label", () => {
    const metadata = metadataFromPreset("tomorrow", now);
    expect(metadata).toEqual({
      remindAt: "2026-06-17T09:00",
      choice: "tomorrow",
      label: "Tomorrow",
    });
  });

  it("builds custom metadata from a date", () => {
    const metadata = metadataFromCustom(new Date("2026-06-20T14:30"), now);
    expect(metadata.choice).toBe("custom");
    expect(metadata.remindAt).toBe("2026-06-20T14:30");
  });
});
