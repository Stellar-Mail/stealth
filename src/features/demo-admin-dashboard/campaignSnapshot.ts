import type { Draft } from "./types/draft";

/**
 * A point-in-time snapshot of a campaign draft dataset.
 */
export interface CampaignSnapshot {
  id: string;
  name: string;
  createdAt?: string; // ISO 8601 format
  draftCount?: number;
  data?: Draft[];
  tags?: string[];
}
