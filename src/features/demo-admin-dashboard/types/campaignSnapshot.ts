import { Draft } from "./draft";

export interface CampaignSnapshot {
  id: string;
  name: string;
  description: string;
  targetAudience: string;
  tags: string[];
  timestamp: string;
  drafts: Draft[];
  status?: "active" | "draft" | "needs-review" | "archived";
}
