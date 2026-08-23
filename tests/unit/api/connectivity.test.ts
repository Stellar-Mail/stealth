import { describe, expect, it } from "vitest";

import { connectivitySnapshot, shouldPauseSync, shouldResumeSync } from "@/lib/api";

describe("connectivity helpers (BETA-071)", () => {
  it("pauses mailbox sync when offline or the document is hidden", () => {
    expect(shouldPauseSync(true, true)).toBe(false);
    expect(shouldPauseSync(false, true)).toBe(true);
    expect(shouldPauseSync(true, false)).toBe(true);
    expect(shouldPauseSync(false, false)).toBe(true);
  });

  it("resumes queries after a paused interval without implying mutation replay", () => {
    expect(shouldResumeSync(true, false)).toBe(true);
    expect(shouldResumeSync(false, false)).toBe(false);
    expect(shouldResumeSync(true, true)).toBe(false);
    expect(shouldResumeSync(false, true)).toBe(false);
  });

  it("reads navigator and visibility snapshots", () => {
    expect(connectivitySnapshot({ onLine: false }, { visibilityState: "visible" })).toEqual({
      online: false,
      visible: true,
    });
    expect(connectivitySnapshot({ onLine: true }, { visibilityState: "hidden" })).toEqual({
      online: true,
      visible: false,
    });
    expect(connectivitySnapshot(null, null)).toEqual({ online: true, visible: true });
  });
});
