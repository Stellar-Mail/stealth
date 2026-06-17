import { describe, expect, it } from "vitest";
import {
  getAdminDashboardBreakpoint,
  getAdminDashboardWidthNote,
  isAdminDashboardWidthSupported,
} from "../layout";

describe("demo admin dashboard responsive layout helpers", () => {
  it.each([
    [768, "tablet"],
    [1023, "tablet"],
    [1024, "laptop"],
    [1439, "laptop"],
    [1440, "desktop"],
  ] as const)("maps %ipx to the %s breakpoint", (width, breakpoint) => {
    expect(getAdminDashboardBreakpoint(width)).toBe(breakpoint);
  });

  it("flags widths below the supported tablet target", () => {
    expect(isAdminDashboardWidthSupported(767)).toBe(false);
    expect(isAdminDashboardWidthSupported(768)).toBe(true);
  });

  it("returns deterministic width notes for review documentation", () => {
    expect(getAdminDashboardWidthNote(1200)).toMatchObject({
      breakpoint: "laptop",
      columns: 2,
      sidebarMode: "rail",
    });
  });
});
