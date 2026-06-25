import type { PresetScenario } from "../types";
import {
  mockDiagnosticId,
  mockMessageHash,
  mockPaymentHash,
  mockSignature,
} from "../mockHashHelpers";

/**
 * Quarantine entry review states for the spam and quarantine scenario preset.
 * Each state represents a distinct phase an incoming message may reach inside the
 * quarantine review queue.
 */
export type QuarantineEntryStatus =
  | "spam-auto-detected"
  | "blocked-no-postage"
  | "blocked-policy-mismatch"
  | "blocked-repeat-offender"
  | "cleared-false-positive";

export interface QuarantineEntry {
  id: string;
  status: QuarantineEntryStatus;
  senderAlias: string;
  senderAddress: string;
  reason: string;
  reviewNote: string;
  postageAmount: string;
}

/**
 * Quarantine review states covering the full lifecycle of a held message.
 * All addresses are fake demo data.
 */
export const quarantineEntries: QuarantineEntry[] = [
  {
    id: "quarantine-spam-auto",
    status: "spam-auto-detected",
    senderAlias: "Promo Bot",
    senderAddress: "promo.bot@example.com",
    reason: "Content matched the bulk promotional pattern filter.",
    reviewNote: "Show admins how the auto-spam classifier surfaces flagged messages.",
    postageAmount: "0 XLM",
  },
  {
    id: "quarantine-no-postage",
    status: "blocked-no-postage",
    senderAlias: "Unknown Contact",
    senderAddress: "unknown.contact@example.com",
    reason: "Sender reached a postage-required inbox without attaching any payment.",
    reviewNote: "Demonstrate that messages without postage are held, not rejected silently.",
    postageAmount: "0 XLM",
  },
  {
    id: "quarantine-policy-mismatch",
    status: "blocked-policy-mismatch",
    senderAlias: "Relay Bypass Attempt",
    senderAddress: "relay.bypass@example.com",
    reason: "Sender relay policy did not satisfy the inbox domain policy requirements.",
    reviewNote: "Show how policy mismatches appear in the quarantine queue for admin review.",
    postageAmount: "0 XLM",
  },
  {
    id: "quarantine-repeat-offender",
    status: "blocked-repeat-offender",
    senderAlias: "Repeat Spammer",
    senderAddress: "repeat.spammer@example.com",
    reason: "Sender has three prior spam detections; auto-block threshold crossed.",
    reviewNote:
      "Teach admins that repeat offenders are flagged automatically after repeated violations.",
    postageAmount: "0 XLM",
  },
  {
    id: "quarantine-false-positive",
    status: "cleared-false-positive",
    senderAlias: "Cleared Sender",
    senderAddress: "cleared.sender@example.com",
    reason: "Message was initially flagged by the pattern filter but cleared after manual review.",
    reviewNote: "Illustrate the false-positive resolution path so reviewers know how to clear items.",
    postageAmount: "0 XLM",
  },
];

/**
 * A blocked sender persona in the quarantine context.
 * Personas carry enough context for a reviewer to understand why the sender is blocked.
 * All data is fake demo data.
 */
export interface BlockedPersona {
  id: string;
  name: string;
  address: string;
  alias: string;
  blockReason: string;
  blockCategory: "spam" | "policy-violation" | "no-postage" | "repeat-offender";
  blockedAt: string;
}

export const blockedPersonas: BlockedPersona[] = [
  {
    id: "blocked-persona-1",
    name: "Promo Bot",
    address: "promo.bot@example.com",
    alias: "promo.bot",
    blockReason: "Automated bulk mailer matched promotional content patterns.",
    blockCategory: "spam",
    blockedAt: "2026-06-10T08:00:00Z",
  },
  {
    id: "blocked-persona-2",
    name: "Relay Bypass Attempt",
    address: "relay.bypass@example.com",
    alias: "relay.bypass",
    blockReason: "Attempted delivery without satisfying inbox domain relay policy.",
    blockCategory: "policy-violation",
    blockedAt: "2026-06-12T14:30:00Z",
  },
  {
    id: "blocked-persona-3",
    name: "Repeat Spammer",
    address: "repeat.spammer@example.com",
    alias: "repeat.spammer",
    blockReason: "Crossed the automatic block threshold after three separate spam detections.",
    blockCategory: "repeat-offender",
    blockedAt: "2026-06-15T11:45:00Z",
  },
];

/**
 * Warning labels used in the spam and quarantine demo scenario.
 * Labels communicate threat or review state at a glance in the inbox UI.
 */
export interface SpamWarningLabel {
  id: string;
  name: string;
  description: string;
  severity: "info" | "warning" | "danger";
}

export const spamWarningLabels: SpamWarningLabel[] = [
  {
    id: "label-spam",
    name: "Spam",
    description: "Message matched an automated spam filter rule.",
    severity: "danger",
  },
  {
    id: "label-blocked",
    name: "Blocked",
    description: "Sender is on the inbox block list or violated policy.",
    severity: "danger",
  },
  {
    id: "label-quarantine",
    name: "Quarantine",
    description: "Message is held pending admin review before delivery.",
    severity: "warning",
  },
  {
    id: "label-review-pending",
    name: "Review-Pending",
    description: "Awaiting manual admin decision on delivery or rejection.",
    severity: "warning",
  },
  {
    id: "label-cleared",
    name: "Cleared",
    description: "Previously flagged message reviewed and cleared for delivery.",
    severity: "info",
  },
];

/**
 * Scenario Preset: Spam and Quarantine Review
 *
 * Populates the demo admin dashboard with a realistic spam detection, blocked
 * sender, and quarantine review workflow. Includes quarantine queue entries,
 * blocked persona records, and warning-labeled mail for admin inspection.
 *
 * All data is fake, deterministic, and safe for public repository review.
 * This is issue 50 of 70 for the Demo Admin Dashboard initiative.
 */
export const spamQuarantineScenarioPreset: PresetScenario = {
  id: "spam-quarantine",
  name: "Spam and Quarantine Review",
  description:
    "Demo admin scenario for spam detection, blocked senders, and quarantine queue review. Covers auto-filtered spam, policy blocks, repeat offenders, and false-positive resolution.",
  stats: [
    { label: "Quarantine Queue", value: "5", delta: "+3" },
    { label: "Blocked Senders", value: "3", delta: "+1" },
    { label: "Auto-Filtered Today", value: "12", delta: "+4" },
    { label: "Cleared (False Positive)", value: "1", delta: "0" },
  ],
  accounts: [
    {
      name: "Admin Reviewer",
      address: "admin*stealth.demo",
      balance: "1,200 XLM",
      type: "Reviewer",
    },
    {
      name: "Spam Filter System",
      address: "spam-filter*stealth.demo",
      balance: "0 XLM",
      type: "System",
    },
    {
      name: "Quarantine Contract",
      address: "CQRNTN...QUAR",
      balance: "500 XLM",
      type: "Soroban Contract",
    },
    {
      name: "Promo Bot",
      address: "promo.bot@example.com",
      balance: "0 XLM",
      type: "Blocked Sender",
    },
    {
      name: "Relay Bypass Attempt",
      address: "relay.bypass@example.com",
      balance: "0 XLM",
      type: "Blocked Sender",
    },
  ],
  mail: [
    {
      subject: "Claim your prize — exclusive offer inside!",
      status: "quarantined",
      folder: "quarantine",
      from: "Promo Bot",
      email: "promo.bot@example.com",
      body: "Congratulations! You have been selected for an exclusive demo prize.\n\nThis is a simulated spam message used in the Demo Admin Dashboard to show how the auto-spam classifier flags bulk promotional content. No real offer exists.\n\n— Demo Spam Filter",
      time: "8:05 AM",
      unread: true,
      starred: false,
      labels: ["Spam", "Auto-Filtered"],
      avatarColor: "#b91c1c",
      verifiedSender: false,
    },
    {
      subject: "Message blocked: no postage attached",
      status: "blocked",
      folder: "quarantine",
      from: "Unknown Contact",
      email: "unknown.contact@example.com",
      body: "This message was blocked because the sender did not attach any postage to reach this protected inbox.\n\nThis demo entry shows how the postage gate prevents unsponsored messages from being delivered. The sender must pay postage before the message enters the review queue.\n\n— Demo Quarantine System",
      time: "9:30 AM",
      unread: true,
      starred: false,
      labels: ["Blocked", "Quarantine"],
      avatarColor: "#92400e",
      verifiedSender: false,
    },
    {
      subject: "Flagged: sender policy mismatch — review required",
      status: "blocked",
      folder: "quarantine",
      from: "Relay Bypass Attempt",
      email: "relay.bypass@example.com",
      body: "This message was quarantined because the sending relay did not satisfy this inbox's domain policy.\n\nDemo context: the relay presented a non-matching relay certificate, triggering the policy gate. Admin review is required before any release or rejection decision.\n\n— Demo Policy Enforcer",
      time: "10:15 AM",
      unread: true,
      starred: false,
      labels: ["Blocked", "Review-Pending"],
      avatarColor: "#7c3aed",
      verifiedSender: false,
      proofMetadata: {
        messageHash: mockMessageHash("sqp-msg-1"),
        paymentHash: mockPaymentHash("sqp-pay-1"),
        diagnosticId: mockDiagnosticId("sqp-trace-1"),
        contractAddress: "CQRNTN...QUAR",
        latency: "38ms",
        signature: mockSignature("sqp-msg-1"),
        postageStatus: "refunded",
      },
    },
    {
      subject: "Auto-blocked: repeat spam sender detected",
      status: "blocked",
      folder: "quarantine",
      from: "Repeat Spammer",
      email: "repeat.spammer@example.com",
      body: "This sender has triggered the spam filter three times and has been automatically blocked.\n\nThis demo entry illustrates how repeat offenders are escalated to an automatic block without manual intervention. No further messages from this address will enter the review queue.\n\n— Demo Repeat-Offender Filter",
      time: "11:00 AM",
      unread: true,
      starred: false,
      labels: ["Spam", "Blocked"],
      avatarColor: "#be123c",
      verifiedSender: false,
    },
    {
      subject: "Quarantine digest — 5 items held for review",
      status: "delivered",
      folder: "inbox",
      from: "Spam Filter System",
      email: "spam-filter*stealth.demo",
      body: "Admin digest: 5 messages are currently held in the quarantine queue.\n\nBreakdown:\n- 2 auto-detected spam\n- 1 blocked (no postage)\n- 1 blocked (policy mismatch)\n- 1 blocked (repeat offender)\n\nOne item was cleared as a false positive earlier today. No action is required on cleared items.\n\n— Demo Spam Filter System",
      time: "12:00 PM",
      unread: false,
      starred: false,
      labels: ["Admin", "Quarantine"],
      avatarColor: "#0369a1",
      verifiedSender: true,
    },
    {
      subject: "Cleared: false positive resolved for demo sender",
      status: "delivered",
      folder: "inbox",
      from: "Admin Reviewer",
      email: "admin*stealth.demo",
      body: "A message from cleared.sender@example.com was initially flagged by the pattern filter.\n\nAfter manual review, the message was determined to be legitimate and released from quarantine. This entry demonstrates the false-positive resolution path in the demo admin dashboard.\n\n— Admin Reviewer",
      time: "1:15 PM",
      unread: false,
      starred: false,
      labels: ["Cleared", "Admin"],
      avatarColor: "#0f766e",
      verifiedSender: true,
      proofMetadata: {
        messageHash: mockMessageHash("sqp-msg-2"),
        paymentHash: mockPaymentHash("sqp-pay-2"),
        diagnosticId: mockDiagnosticId("sqp-trace-2"),
        contractAddress: "CQRNTN...QUAR",
        latency: "21ms",
        signature: mockSignature("sqp-msg-2"),
        postageStatus: "refunded",
      },
    },
  ],
  attachments: [
    {
      id: "sqp-att-1",
      fileName: "spam_filter_report_2026-06-25.json",
      fileSize: "14 KB",
      fileType: "JSON",
      messageSubject: "Quarantine digest — 5 items held for review",
      sender: "spam-filter*stealth.demo",
    },
    {
      id: "sqp-att-2",
      fileName: "policy_mismatch_evidence.txt",
      fileSize: "3.2 KB",
      fileType: "Text",
      messageSubject: "Flagged: sender policy mismatch — review required",
      sender: "admin*stealth.demo",
    },
    {
      id: "sqp-att-3",
      fileName: "false_positive_review_log.pdf",
      fileSize: "88 KB",
      fileType: "PDF Document",
      messageSubject: "Cleared: false positive resolved for demo sender",
      sender: "admin*stealth.demo",
    },
  ],
  events: [
    {
      id: "evt-quarantine-review",
      title: "Weekly Quarantine Review Session",
      date: "2026-06-30",
      time: "2:00 PM",
      location: "Admin Dashboard — Quarantine Panel",
      organizer: "admin*stealth.demo",
      status: "confirmed",
    },
  ],
  auditEvents: [
    {
      action: "Spam auto-filter rule triggered for promo.bot@example.com",
      actor: "spam-filter*stealth.demo",
      timestamp: "2026-06-25T08:05:00Z",
    },
    {
      action: "Message blocked: no postage from unknown.contact@example.com",
      actor: "system",
      timestamp: "2026-06-25T09:30:00Z",
    },
    {
      action: "Policy mismatch quarantine triggered for relay.bypass@example.com",
      actor: "system",
      timestamp: "2026-06-25T10:15:00Z",
    },
    {
      action: "Auto-block applied: repeat.spammer@example.com exceeded spam threshold",
      actor: "system",
      timestamp: "2026-06-25T11:00:00Z",
    },
    {
      action: "False positive cleared by admin: cleared.sender@example.com released",
      actor: "admin*stealth.demo",
      timestamp: "2026-06-25T13:15:00Z",
    },
  ],
};

/**
 * Returns a plain-English summary of the quarantine entry states for display in
 * reviewer tooling and audit digests.
 */
export function getQuarantineSummary(entries = quarantineEntries): string {
  const spam = entries.filter((e) => e.status === "spam-auto-detected").length;
  const blocked = entries.filter(
    (e) =>
      e.status === "blocked-no-postage" ||
      e.status === "blocked-policy-mismatch" ||
      e.status === "blocked-repeat-offender",
  ).length;
  const cleared = entries.filter((e) => e.status === "cleared-false-positive").length;

  return `${entries.length} quarantine entries: ${spam} spam, ${blocked} blocked, ${cleared} cleared.`;
}

/**
 * Validates the spam/quarantine preset shape and safety constraints.
 * Returns a list of error strings; empty list means the preset is valid.
 */
export function validateSpamQuarantinePreset(
  preset = spamQuarantineScenarioPreset,
  entries = quarantineEntries,
  personas = blockedPersonas,
): string[] {
  const errors: string[] = [];

  const requiredStatuses: QuarantineEntryStatus[] = [
    "spam-auto-detected",
    "blocked-no-postage",
    "blocked-policy-mismatch",
    "blocked-repeat-offender",
    "cleared-false-positive",
  ];
  const presentStatuses = new Set(entries.map((e) => e.status));
  for (const status of requiredStatuses) {
    if (!presentStatuses.has(status)) {
      errors.push(`Missing quarantine entry status: ${status}`);
    }
  }

  for (const entry of entries) {
    if (!entry.reason.trim() || !entry.reviewNote.trim()) {
      errors.push(`Missing reason or reviewNote for ${entry.id}`);
    }
  }

  for (const persona of personas) {
    if (!persona.blockReason.trim()) {
      errors.push(`Missing blockReason for blocked persona ${persona.id}`);
    }
  }

  for (const mail of preset.mail) {
    const safePattern = /(\*stealth\.demo|@example\.(com|org))$/;
    if (!safePattern.test(mail.email)) {
      errors.push(`Unsafe email address in mail: ${mail.email}`);
    }
  }

  if (!preset.attachments.length) {
    errors.push("Preset must include at least one attachment.");
  }

  if (!preset.events.length) {
    errors.push("Preset must include at least one calendar event.");
  }

  return errors;
}
