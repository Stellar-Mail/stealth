import type { AudienceSegmentId } from "./audienceSegment";
import type { CampaignStatus } from "./campaignSnapshot";

/** Top-level categories used to classify demo campaign groups. */
export type CampaignGroupCategory =
  | "onboarding"
  | "newsletter"
  | "security"
  | "events"
  | "operations";

/**
 * A logical grouping of related demo campaigns.
 * Groups collect campaigns that share a common goal so maintainers
 * can review related campaign records side by side.
 */
export interface CampaignGroup {
  id: string;
  name: string;
  description: string;
  category: CampaignGroupCategory;
  /** Ordered campaign IDs belonging to this group. */
  campaignIds: string[];
}

/**
 * The canonical demo campaign record.
 * Represents a single distinct campaign story in the admin dashboard.
 * A campaign belongs to exactly one group and targets one audience segment.
 */
export interface CampaignRecord {
  id: string;
  name: string;
  description: string;
  /** References the CampaignGroup this campaign belongs to. */
  groupId: string;
  /** References the AudienceSegment this campaign targets. */
  audienceId: AudienceSegmentId;
  status: CampaignStatus;
  tags: string[];
  /** Ordered IDs of demo message drafts attached to this campaign. */
  messageIds: string[];
  createdAt: string;
  updatedAt: string;
}

/** Describes the role a demo message plays within a campaign sequence. */
export type CampaignMessageRole = "primary" | "followup" | "notification";

/**
 * An explicit link between a campaign record and a demo message draft.
 * Captures why the message was attached and its position in the sequence.
 */
export interface CampaignMessageLink {
  campaignId: string;
  messageId: string;
  role: CampaignMessageRole;
  /** Zero-based position within the campaign message sequence. */
  sequenceIndex: number;
}

/**
 * The fully resolved relationship view for a single campaign.
 * Used by admin panels to render a campaign alongside its group,
 * audience, and messages without repeated lookups.
 */
export interface CampaignRelationshipMap {
  campaign: CampaignRecord;
  group: CampaignGroup;
  /** Human-readable audience label resolved from the AudienceSegment. */
  audienceLabel: string;
  /** Estimated audience size for display purposes. */
  audienceSize: number;
  messageLinks: CampaignMessageLink[];
}
