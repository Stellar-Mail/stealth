import type { DemoLabel, LabeledDemoMessage } from "./types";

/**
 * Deterministic, fake labels for the demo label manager. Ids are pre-normalized
 * (see `toLabelId`) so they stay stable across renders and tests. "archive" is
 * intentionally unused so the cleanup view always has an example.
 */
export const demoLabels: DemoLabel[] = [
  { id: "follow-up", name: "Follow up", color: "amber" },
  { id: "invoices", name: "Invoices", color: "emerald" },
  { id: "events", name: "Events", color: "sky" },
  { id: "partners", name: "Partners", color: "violet" },
  { id: "archive", name: "Archive", color: "rose" },
];

/**
 * Deterministic, fake demo messages. Senders use the reserved `*stealth.demo`
 * handle so nothing references real people or live addresses. Every entry in
 * `labelIds` references an id in `demoLabels`.
 */
export const labeledDemoMessages: LabeledDemoMessage[] = [
  {
    id: "lbl-studio-visit",
    subject: "Studio visit follow-up",
    from: "Aria Voss",
    email: "aria*stealth.demo",
    labelIds: ["follow-up", "partners"],
  },
  {
    id: "lbl-invoice-review",
    subject: "Invoice review before sign-off",
    from: "Billing System",
    email: "billing*stealth.demo",
    labelIds: ["invoices"],
  },
  {
    id: "lbl-roundtable-prep",
    subject: "Prep notes for the demo roundtable",
    from: "Events Desk",
    email: "events*stealth.demo",
    labelIds: ["events", "follow-up"],
  },
  {
    id: "lbl-quarterly-digest",
    subject: "Quarterly product digest draft",
    from: "Digest Bot",
    email: "digest*stealth.demo",
    labelIds: [],
  },
  {
    id: "lbl-partner-sync",
    subject: "Partner sync recap",
    from: "Partnerships",
    email: "partners*stealth.demo",
    labelIds: ["partners"],
  },
  {
    id: "lbl-invoice-reminder",
    subject: "Second invoice reminder",
    from: "Billing System",
    email: "billing*stealth.demo",
    labelIds: ["invoices", "follow-up"],
  },
];
