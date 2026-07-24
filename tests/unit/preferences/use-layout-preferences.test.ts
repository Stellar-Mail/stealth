import { describe, expect, it } from "vitest";
import { clampLayoutPreferences } from "../../../src/features/preferences/useLayoutPreferences";
import {
  defaultLayoutPreferences,
  type LayoutPreferences,
} from "../../../src/features/preferences/layout-types";

describe("preferences/clampLayoutPreferences", () => {
  it("leaves in-range layout widths untouched (success path)", () => {
    const inRange: LayoutPreferences = {
      ...defaultLayoutPreferences,
      sidebarWidth: 15,
      listWidth: 30,
      readerWidth: 35,
    };
    expect(clampLayoutPreferences(inRange)).toEqual(inRange);
  });

  it("clamps out-of-range widths back into the usable bounds (edge case)", () => {
    const tooWide: LayoutPreferences = {
      ...defaultLayoutPreferences,
      sidebarWidth: 95,
      listWidth: 95,
      readerWidth: 95,
    };
    expect(clampLayoutPreferences(tooWide)).toMatchObject({
      sidebarWidth: 40,
      listWidth: 60,
      readerWidth: 80,
    });

    const tooNarrow: LayoutPreferences = {
      ...defaultLayoutPreferences,
      sidebarWidth: 0,
      listWidth: 1,
      readerWidth: 2,
    };
    expect(clampLayoutPreferences(tooNarrow)).toMatchObject({
      sidebarWidth: 5,
      listWidth: 10,
      readerWidth: 15,
    });
  });

  it("preserves the exact min and max bounds (boundary values)", () => {
    const atBounds: LayoutPreferences = {
      ...defaultLayoutPreferences,
      sidebarWidth: 40,
      listWidth: 10,
      readerWidth: 80,
    };
    expect(clampLayoutPreferences(atBounds)).toMatchObject({
      sidebarWidth: 40,
      listWidth: 10,
      readerWidth: 80,
    });
  });

  it("does not mutate the input object (failure-safety)", () => {
    const input: LayoutPreferences = { ...defaultLayoutPreferences, sidebarWidth: 100 };
    const snapshot = { ...input };
    clampLayoutPreferences(input);
    expect(input).toEqual(snapshot);
  });

  it("carries non-width fields through unchanged", () => {
    const input: LayoutPreferences = {
      ...defaultLayoutPreferences,
      sidebarCollapsed: true,
      rightPanelCollapsed: true,
      compactMode: true,
      sidebarWidth: 999,
    };
    const result = clampLayoutPreferences(input);
    expect(result.sidebarCollapsed).toBe(true);
    expect(result.rightPanelCollapsed).toBe(true);
    expect(result.compactMode).toBe(true);
  });
});
