import type { CampaignStatus } from "./campaignStatus";
import { Draft } from "./draft";

export interface CampaignSnapshot {
  id: string;
  name: string;
  description: string;
  targetAudience: string;
  tags: string[];
  timestamp: string;
  drafts: Draft[];
  status?: CampaignStatus;
}
