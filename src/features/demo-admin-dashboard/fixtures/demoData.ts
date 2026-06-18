import type {
  AdminDashboardLayoutCheck,
  AdminDashboardPanel,
  AdminDashboardWidthNote,
} from "../types";

export const adminDashboardPanels: AdminDashboardPanel[] = [
  {
    id: "seed-inbox",
    title: "Inbox seed data",
    description:
      "Curated fake conversations for validating demo inbox states without touching production mail.",
    status: "ready",
    demoRecords: 24,
  },
  {
    id: "policy-lab",
    title: "Sender policy lab",
    description:
      "Deterministic allow, quarantine, and postage scenarios maintainers can replay during reviews.",
    status: "needs-review",
    demoRecords: 12,
  },
  {
    id: "calendar-briefs",
    title: "Calendar briefs",
    description: "Public-safe meeting cards that exercise tablet wrapping and summary density.",
    status: "draft",
    demoRecords: 8,
  },
];

export const adminDashboardWidthNotes: AdminDashboardWidthNote[] = [
  {
    breakpoint: "tablet",
    minWidth: 768,
    maxWidth: 1023,
    columns: 1,
    sidebarMode: "stacked",
    note: "Primary controls stack above cards so touch targets stay visible at tablet widths.",
  },
  {
    breakpoint: "laptop",
    minWidth: 1024,
    maxWidth: 1439,
    columns: 2,
    sidebarMode: "rail",
    note: "Summary cards use a two-column grid with a compact rail for review checkpoints.",
  },
  {
    breakpoint: "desktop",
    minWidth: 1440,
    columns: 3,
    sidebarMode: "expanded",
    note: "Wide screens expose the full checkpoint panel while preserving readable card measure.",
  },
];

export const adminDashboardLayoutChecks: AdminDashboardLayoutCheck[] = [
  {
    id: "tablet-controls-first",
    label: "Controls precede data cards",
    breakpoint: "tablet",
    expected: "Filter and import actions remain above the one-column panel list.",
  },
  {
    id: "laptop-two-up",
    label: "Two-up card grid",
    breakpoint: "laptop",
    expected: "Cards flow into two balanced columns without horizontal scrolling.",
  },
  {
    id: "desktop-checkpoint-panel",
    label: "Persistent checkpoint panel",
    breakpoint: "desktop",
    expected: "Layout checks sit beside the three-column data grid for quick review.",
  },
];
