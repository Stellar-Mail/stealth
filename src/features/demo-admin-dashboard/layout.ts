import { adminDashboardWidthNotes } from "./fixtures/demoData";
import type { AdminDashboardBreakpoint, AdminDashboardWidthNote } from "./types";

export const ADMIN_DASHBOARD_MIN_SUPPORTED_WIDTH = 768;

export function getAdminDashboardBreakpoint(width: number): AdminDashboardBreakpoint {
  if (width >= 1440) {
    return "desktop";
  }

  if (width >= 1024) {
    return "laptop";
  }

  return "tablet";
}

export function getAdminDashboardWidthNote(width: number): AdminDashboardWidthNote {
  const breakpoint = getAdminDashboardBreakpoint(width);
  const note = adminDashboardWidthNotes.find((entry) => entry.breakpoint === breakpoint);

  if (!note) {
    throw new Error(`Missing admin dashboard width note for ${breakpoint}`);
  }

  return note;
}

export function isAdminDashboardWidthSupported(width: number): boolean {
  return width >= ADMIN_DASHBOARD_MIN_SUPPORTED_WIDTH;
}
