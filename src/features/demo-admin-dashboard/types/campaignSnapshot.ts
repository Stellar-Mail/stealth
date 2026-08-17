import type { Draft } from "./draft";

export type CampaignStatus = "active" | "draft" | "needs-review" | "archived";

export interface CampaignSnapshot {
  id: string;
  name: string;
  description: string;
  targetAudience: string;
  tags: string[];
  timestamp: string;
  status: CampaignStatus;
  drafts: Draft[];
  draftCount?: number;
  createdAt?: string;
  data?: Draft[];
}
