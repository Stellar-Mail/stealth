export type CampaignStatus =
  | "draft"
  | "ready"
  | "active"
  | "paused"
  | "archived"
  | "failed";

export const CAMPAIGN_STATUSES: CampaignStatus[] = [
  "draft",
  "ready",
  "active",
  "paused",
  "archived",
  "failed",
];

export const INITIAL_CAMPAIGN_STATUS: CampaignStatus = "draft";

export const TERMINAL_STATUSES: readonly CampaignStatus[] = ["archived"];

export interface CampaignStatusTransition {
  from: CampaignStatus;
  to: CampaignStatus;
  label: string;
  description: string;
}

export interface CampaignStatusRecord {
  id: string;
  name: string;
  description: string;
  status: CampaignStatus;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export type CampaignStatusSummary = Record<CampaignStatus, number>;
