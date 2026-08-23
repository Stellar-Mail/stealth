/**
 * Preset copy for the demo admin dashboard empty states. Each entry is static,
 * fake, and safe for public review — no real user data, addresses, or secrets.
 */
export type AdminEmptyStateKind =
  "messages" | "senders" | "attachments" | "events" | "validation" | "kpis";

export interface AdminEmptyStateCopy {
  /** Short, friendly heading. */
  title: string;
  /** One-line supporting description. */
  description: string;
  /** Suggested call-to-action label for the CTA slot (optional). */
  ctaLabel?: string;
}

export const ADMIN_EMPTY_STATE_PRESETS: Record<AdminEmptyStateKind, AdminEmptyStateCopy> = {
  messages: {
    title: "No messages yet",
    description: "Demo messages will show here once the dataset loads.",
    ctaLabel: "Add demo messages",
  },
  senders: {
    title: "No senders yet",
    description: "Add demo sender personas to preview sender details.",
    ctaLabel: "Add demo senders",
  },
  attachments: {
    title: "No attachments yet",
    description: "Attachments from demo messages will be listed here.",
    ctaLabel: "Add demo attachments",
  },
  events: {
    title: "No events yet",
    description: "Scheduled demo events will appear here when present.",
    ctaLabel: "Add demo events",
  },
  validation: {
    title: "No validation results yet",
    description: "Run validation to see passes, warnings, and errors.",
    ctaLabel: "Run validation",
  },
  kpis: {
    title: "No analytics yet",
    description: "KPI data will appear once the campaign fixture loads.",
    ctaLabel: "Load KPI data",
  },
};

/** Look up the preset copy for a given empty-state kind. */
export function getAdminEmptyStatePreset(kind: AdminEmptyStateKind): AdminEmptyStateCopy {
  return ADMIN_EMPTY_STATE_PRESETS[kind];
}

/** All supported empty-state kinds, in display order. */
export const ADMIN_EMPTY_STATE_KINDS: AdminEmptyStateKind[] = [
  "messages",
  "senders",
  "attachments",
  "events",
  "validation",
  "kpis",
];
