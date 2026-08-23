import type { PostageRecord, PostageStatus } from "@/lib/api";
import type { PostageActionPermission, PostageTimelineEvent } from "./postage-types";

/**
 * Derives permitted actions based on the current status of the postage
 * and whether the actor is the sender or the recipient.
 */
export function permittedActions(
  status: PostageStatus,
  actorAddress: string,
  postage: PostageRecord,
): PostageActionPermission {
  const isSender = actorAddress === postage.sender;
  const isRecipient = actorAddress === postage.recipient;

  return {
    canSettle:
      isRecipient && (status === "pending" || status === "expired" || status === "disputed"),
    canRefund:
      isRecipient && (status === "pending" || status === "expired" || status === "disputed"),
    canDispute: isSender && (status === "pending" || status === "expired"),
    canExpire: isSender && status === "pending",
    canReclaim: isSender && status === "expired",
  };
}

const EXPLORER_BASE = "https://stellar.expert/explorer";

export function explorerTxLink(hash: string, network: string = "testnet"): string {
  return `${EXPLORER_BASE}/${network}/tx/${hash}`;
}

export function explorerAccountLink(address: string, network: string = "testnet"): string {
  return `${EXPLORER_BASE}/${network}/account/${address}`;
}

export function describeStatus(status: PostageStatus): string {
  switch (status) {
    case "pending":
      return "Escrow reserved, pending settlement or expiry.";
    case "expired":
      return "Escrow expired, funds can be reclaimed by sender.";
    case "disputed":
      return "Escrow disputed by sender.";
    case "settled":
      return "Escrow settled to the recipient.";
    case "refunded":
      return "Escrow refunded to the sender.";
    case "reclaimed":
      return "Escrow reclaimed by the sender after expiry.";
    default:
      return "Unknown status.";
  }
}

export function formatPostageTimeline(postage: PostageRecord): PostageTimelineEvent[] {
  const timeline: PostageTimelineEvent[] = [
    {
      id: "submitted",
      label: "Postage submitted",
      timestamp: postage.createdAt,
      status: "completed",
      description: "Contract state recorded",
      txHash: postage.paymentHash,
    },
  ];

  if (postage.status === "pending") {
    timeline.push({
      id: "dispute_window",
      label: "Dispute window active",
      timestamp: null,
      status: "current",
      description: "Sender can dispute before expiry",
    });
    timeline.push({
      id: "resolution",
      label: "Final resolution",
      timestamp: null,
      status: "upcoming",
      description: "Waiting for settlement or expiry",
    });
  } else if (postage.status === "disputed") {
    timeline.push({
      id: "disputed",
      label: "Disputed",
      timestamp: null,
      status: "current",
      description: "Dispute raised by sender",
    });
    timeline.push({
      id: "resolution",
      label: "Final resolution",
      timestamp: null,
      status: "upcoming",
      description: "Waiting for recipient to settle or refund",
    });
  } else if (postage.status === "expired") {
    timeline.push({
      id: "expired",
      label: "Expired",
      timestamp: null,
      status: "current",
      description: "Escrow has expired",
    });
    timeline.push({
      id: "resolution",
      label: "Reclaim",
      timestamp: null,
      status: "upcoming",
      description: "Waiting for sender to reclaim",
    });
  } else {
    // Terminal states
    timeline.push({
      id: "resolution",
      label: `Resolved: ${postage.status}`,
      timestamp: null, // Ideally we'd have the resolved timestamp here
      status: "completed",
      description: describeStatus(postage.status),
    });
  }

  return timeline;
}
