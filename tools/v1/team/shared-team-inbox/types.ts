export type SharedInboxMessageStatus =
  | "unassigned"
  | "claimed"
  | "in-progress"
  | "awaiting-reply"
  | "resolved";

export interface SharedInboxAssignee {
  id: string;
  displayName: string;
  stealthAddress: string;
}

export interface SharedInboxMessage {
  id: string;
  senderAddress: string;
  subject: string;
  preview: string;
  status: SharedInboxMessageStatus;
  team: string;
  receivedAt: string;
  deliveryProofHash: string;
  assignee?: SharedInboxAssignee;
  internalCommentCount: number;
  replyCount: number;
}

export interface SharedInboxSummary {
  total: number;
  unassigned: number;
  claimed: number;
  inProgress: number;
  awaitingReply: number;
  resolved: number;
}

export interface SharedInboxActionHandlers {
  onClaim?: (messageId: string) => void;
  onRelease?: (messageId: string) => void;
  onOpenMessage?: (messageId: string) => void;
  onReply?: (messageId: string) => void;
  onStatusFilterChange?: (status: SharedInboxMessageStatus | "all") => void;
}
