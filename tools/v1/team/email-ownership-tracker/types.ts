export type OwnershipStatus = "unassigned" | "owned" | "stale" | "resolved";

export interface OwnershipRecord {
  id: string;
  messageId: string;
  subject: string;
  senderLabel: string;
  status: OwnershipStatus;
  owner?: string;
  team: string;
  updatedAt: string;
  ageMinutes: number;
  lastAction: string;
}

export interface OwnershipSummary {
  totalMessages: number;
  unassigned: number;
  owned: number;
  stale: number;
  resolved: number;
}
