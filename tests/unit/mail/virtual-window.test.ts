import { describe, expect, it } from "vitest";

import {
  computeVirtualWindow,
  DEFAULT_OVERSCAN,
  INITIAL_WINDOW_SIZE,
} from "@/components/mail/virtual-window";

describe("mailbox list virtualization (BETA-074)", () => {
  it("renders an initial window before the container is measured", () => {
    const window = computeVirtualWindow({
      count: 10_000,
      scrollTop: 0,
      viewportHeight: 0,
      rowHeight: 72,
    });
    expect(window).toEqual({ start: 0, end: INITIAL_WINDOW_SIZE });
    expect(window.end - window.start).toBeLessThanOrEqual(INITIAL_WINDOW_SIZE);
  });

  it("keeps a 10,000-row mailbox windowed to a constant mount size", () => {
    // A tall scroll container: 800px viewport, 72px rows => ~11 visible rows.
    const top = computeVirtualWindow({
      count: 10_000,
      scrollTop: 0,
      viewportHeight: 800,
      rowHeight: 72,
    });
    const middle = computeVirtualWindow({
      count: 10_000,
      scrollTop: 500 * 72,
      viewportHeight: 800,
      rowHeight: 72,
    });
    const nearEnd = computeVirtualWindow({
      count: 10_000,
      scrollTop: (10_000 - 30) * 72,
      viewportHeight: 800,
      rowHeight: 72,
    });

    const mountSize = (w: { start: number; end: number }) => w.end - w.start;
    // Window size never depends on total row count — bounded memory growth.
    expect(mountSize(top)).toBeLessThanOrEqual(16 + DEFAULT_OVERSCAN * 2);
    expect(mountSize(middle)).toBeLessThanOrEqual(16 + DEFAULT_OVERSCAN * 2);
    expect(mountSize(nearEnd)).toBeLessThanOrEqual(16 + DEFAULT_OVERSCAN * 2);
    // The window actually advances with scroll.
    expect(middle.start).toBeGreaterThan(top.start);
    expect(nearEnd.start).toBeGreaterThan(middle.start);
  });

  it("clamps the window to the row count near the end of the list", () => {
    const window = computeVirtualWindow({
      count: 100,
      scrollTop: 99 * 72,
      viewportHeight: 800,
      rowHeight: 72,
    });
    expect(window.end).toBe(100);
    expect(window.start).toBeLessThan(100);
  });

  it("returns an empty window for an empty list", () => {
    expect(
      computeVirtualWindow({ count: 0, scrollTop: 0, viewportHeight: 800, rowHeight: 72 }),
    ).toEqual({
      start: 0,
      end: 0,
    });
  });

  it("applies a custom overscan", () => {
    const window = computeVirtualWindow({
      count: 10_000,
      scrollTop: 0,
      viewportHeight: 800,
      rowHeight: 72,
      overscan: 20,
    });
    // ~11 visible rows + 20 overscan above and below.
    expect(window.end - window.start).toBeGreaterThan(30);
  });
});
