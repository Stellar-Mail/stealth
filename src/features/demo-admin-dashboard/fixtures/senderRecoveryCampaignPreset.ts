import type { CampaignSnapshot } from "../types/campaignSnapshot";

export type SenderRecoveryRequestStatus =
  "unknown" | "paid-request" | "approved" | "blocked" | "refund-queued";

export interface SenderRecoveryRequestState {
  id: string;
  status: SenderRecoveryRequestStatus;
  senderAlias: string;
  senderAddress: string;
  outcome: string;
  educationPoint: string;
  refundAmount: string;
}

export const senderRecoveryRequestStates: SenderRecoveryRequestState[] = [
  {
    id: "sender-recovery-unknown",
    status: "unknown",
    senderAlias: "Unknown sender",
    senderAddress: "unknown.sender@stealth.demo",
    outcome: "Explain why the sender was routed into paid request review.",
    educationPoint: "Show admins how to evaluate sender reputation before approval.",
    refundAmount: "0 XLM",
  },
  {
    id: "sender-recovery-paid",
    status: "paid-request",
    senderAlias: "Paid requester",
    senderAddress: "paid.requester@stealth.demo",
    outcome: "Show that the sender posted demo postage before the request enters review.",
    educationPoint: "Teach reviewers where postage evidence appears in the request flow.",
    refundAmount: "0 XLM",
  },
  {
    id: "sender-recovery-approved",
    status: "approved",
    senderAlias: "Approved sender",
    senderAddress: "approved.sender@stealth.demo",
    outcome: "Demonstrate the path from paid request to trusted sender approval.",
    educationPoint: "Explain how approvals affect future inbox placement.",
    refundAmount: "0 XLM",
  },
  {
    id: "sender-recovery-blocked",
    status: "blocked",
    senderAlias: "Blocked sender",
    senderAddress: "blocked.sender@stealth.demo",
    outcome: "Show the blocked outcome when review evidence is incomplete.",
    educationPoint: "Teach admins that blocked senders keep fake evidence for audit review.",
    refundAmount: "0 XLM",
  },
  {
    id: "sender-recovery-refund",
    status: "refund-queued",
    senderAlias: "Refund education sender",
    senderAddress: "refund.sender@stealth.demo",
    outcome: "Explain the refund queue when a paid request is rejected in the demo.",
    educationPoint: "Highlight that refund copy is educational and never uses live payment rails.",
    refundAmount: "2.0000000 XLM",
  },
];

export const senderRecoveryCampaignPreset: CampaignSnapshot = {
  id: "snap-sender-recovery-preset",
  name: "Sender Recovery Education",
  description:
    "Fake campaign preset for unknown senders, paid requests, approvals, blocks, and refund education.",
  targetAudience: "Mailbox admins",
  tags: ["sender-recovery", "paid-requests", "refund-education"],
  timestamp: "2026-06-20T00:00:00Z",
  status: "needs-review",
  drafts: senderRecoveryRequestStates.map((state, index) => ({
    id: `draft-${state.id}`,
    subject: `${index + 1}. ${state.senderAlias}: ${state.status}`,
    body: [
      `Scenario: ${state.outcome}`,
      `Education: ${state.educationPoint}`,
      `Demo refund amount: ${state.refundAmount}`,
      "All addresses and payment values in this campaign are fake demo data.",
    ].join("\n\n"),
    recipients: [state.senderAddress],
  })),
};

export function getSenderRecoveryOutcomeSummary(states = senderRecoveryRequestStates): string {
  const approvals = states.filter((state) => state.status === "approved").length;
  const blocked = states.filter((state) => state.status === "blocked").length;
  const refunds = states.filter((state) => state.status === "refund-queued").length;

  return `${states.length} recovery states: ${approvals} approved, ${blocked} blocked, ${refunds} refund education.`;
}

export function validateSenderRecoveryCampaignPreset(
  campaign = senderRecoveryCampaignPreset,
  states = senderRecoveryRequestStates,
): string[] {
  const errors: string[] = [];
  const requiredStatuses: SenderRecoveryRequestStatus[] = [
    "unknown",
    "paid-request",
    "approved",
    "blocked",
    "refund-queued",
  ];
  const statuses = new Set(states.map((state) => state.status));

  for (const status of requiredStatuses) {
    if (!statuses.has(status)) {
      errors.push(`Missing sender recovery state: ${status}`);
    }
  }

  if (!campaign.tags.includes("sender-recovery")) {
    errors.push("Campaign preset must include the sender-recovery tag.");
  }

  if (campaign.drafts.length !== states.length) {
    errors.push("Campaign preset must include one draft per sender recovery state.");
  }

  for (const state of states) {
    if (!state.senderAddress.endsWith("@stealth.demo")) {
      errors.push(`Unsafe sender address for ${state.id}.`);
    }
    if (!state.outcome.trim() || !state.educationPoint.trim()) {
      errors.push(`Missing outcome or education point for ${state.id}.`);
    }
  }

  return errors;
}
