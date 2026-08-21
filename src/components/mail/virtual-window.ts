// ---------------------------------------------------------------------------
// BETA-074 (Issue #1981) — virtualized list window math.
//
// Pure computation shared by the mailbox list and its unit tests: given a
// scroll offset and viewport height, derive the inclusive row window to mount.
// The window is conservative (rows are estimated taller than reality) and an
// overscan keeps rows just outside the viewport mounted so scrolling never
// flashes empty space.
// ---------------------------------------------------------------------------

export interface VirtualWindowInput {
  /** Total number of rows in the list. */
  count: number;
  /** Current scrollTop of the scroll container, in px. */
  scrollTop: number;
  /** Client height of the scroll container, in px. 0 means not yet measured. */
  viewportHeight: number;
  /** Estimated row height (must be >= the tallest real row). */
  rowHeight: number;
  /** Rows to keep mounted above/below the visible range. */
  overscan?: number;
}

export interface VirtualWindow {
  start: number;
  end: number;
}

export const DEFAULT_OVERSCAN = 8;
export const INITIAL_WINDOW_SIZE = 24;

export function computeVirtualWindow({
  count,
  scrollTop,
  viewportHeight,
  rowHeight,
  overscan = DEFAULT_OVERSCAN,
}: VirtualWindowInput): VirtualWindow {
  if (count <= 0) return { start: 0, end: 0 };
  if (rowHeight <= 0) return { start: 0, end: Math.min(count, INITIAL_WINDOW_SIZE) };

  // Before the container is measured we render a small initial window so the
  // first paint is not empty.
  if (viewportHeight <= 0) {
    return { start: 0, end: Math.min(count, INITIAL_WINDOW_SIZE) };
  }

  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const end = Math.min(count, Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan);
  return { start, end };
}
