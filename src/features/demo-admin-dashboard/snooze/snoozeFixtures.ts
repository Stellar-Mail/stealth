import type { SnoozedDemoMessage } from "./types";

/**
 * Deterministic, fake snoozed demo messages.
 *
 * Senders use the reserved `*stealth.demo` handle so nothing references real
 * people or live addresses. `remindAt` values are local stamps relative to the
 * demo clock (2026-06-16T09:00) and are all in the future, so the snoozed
 * folder always has plausible upcoming reminders.
 */
export const snoozedDemoMessages: SnoozedDemoMessage[] = [
  {
    id: "snz-studio-visit",
    subject: "Studio visit follow-up",
    from: "Aria Voss",
    email: "aria*stealth.demo",
    snooze: { remindAt: "2026-06-17T09:00", choice: "tomorrow", label: "Tomorrow" },
  },
  {
    id: "snz-invoice-review",
    subject: "Invoice review before sign-off",
    from: "Billing System",
    email: "billing*stealth.demo",
    snooze: { remindAt: "2026-06-16T12:00", choice: "later-today", label: "Later today" },
  },
  {
    id: "snz-roundtable-prep",
    subject: "Prep notes for the demo roundtable",
    from: "Events Desk",
    email: "events*stealth.demo",
    snooze: { remindAt: "2026-06-20T09:00", choice: "this-weekend", label: "This weekend" },
  },
  {
    id: "snz-quarterly-digest",
    subject: "Quarterly product digest draft",
    from: "Digest Bot",
    email: "digest*stealth.demo",
    snooze: { remindAt: "2026-06-22T09:00", choice: "next-week", label: "Next week" },
  },
  {
    id: "snz-partner-sync",
    subject: "Partner sync recap",
    from: "Partnerships",
    email: "partners*stealth.demo",
    snooze: { remindAt: "2026-06-18T14:30", choice: "custom", label: "Thu, Jun 18" },
  },
];
