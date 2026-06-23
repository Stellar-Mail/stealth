import type {
  CampaignGroup,
  CampaignMessageLink,
  CampaignRecord,
  CampaignRelationshipMap,
} from "../types/campaignTaxonomy";

// ---------------------------------------------------------------------------
// Campaign Groups
// ---------------------------------------------------------------------------

export const campaignGroups: CampaignGroup[] = [
  {
    id: "group-onboarding",
    name: "Onboarding Series",
    description:
      "Campaigns sent to newly registered accounts to introduce Stealth features and Stellar wallet setup.",
    category: "onboarding",
    campaignIds: ["camp-welcome", "camp-wallet-setup"],
  },
  {
    id: "group-newsletter",
    name: "Protocol Newsletter",
    description:
      "Monthly and quarterly digests keeping investors, founders, and relay operators up to date on protocol progress.",
    category: "newsletter",
    campaignIds: ["camp-investor-q3", "camp-relay-digest"],
  },
  {
    id: "group-security",
    name: "Security Notices",
    description:
      "Transactional security alerts triggered by policy changes, new-device logins, or passphrase confirmation requests.",
    category: "security",
    campaignIds: ["camp-passphrase-confirm", "camp-cold-outreach-notice"],
  },
  {
    id: "group-events",
    name: "Event Outreach",
    description:
      "Pre-event and post-event communication for Stellar ecosystem conferences and Stealth booth presence.",
    category: "events",
    campaignIds: ["camp-summit-invite"],
  },
];

// ---------------------------------------------------------------------------
// Campaign Records
// ---------------------------------------------------------------------------

export const campaignRecords: CampaignRecord[] = [
  {
    id: "camp-welcome",
    name: "Welcome Onboarding",
    description: "Two-message intro sequence sent to every new Stealth account on signup.",
    groupId: "group-onboarding",
    audienceId: "founders",
    status: "active",
    tags: ["onboarding", "welcome"],
    messageIds: ["msg-welcome-1", "msg-welcome-2"],
    createdAt: "2026-06-01T08:00:00Z",
    updatedAt: "2026-06-17T10:00:00Z",
  },
  {
    id: "camp-wallet-setup",
    name: "Wallet Setup Prompt",
    description: "Follow-up message sent 48 hours after signup if the user has not linked a Stellar wallet.",
    groupId: "group-onboarding",
    audienceId: "founders",
    status: "draft",
    tags: ["onboarding", "stellar"],
    messageIds: ["msg-wallet-1"],
    createdAt: "2026-06-01T08:30:00Z",
    updatedAt: "2026-06-14T09:00:00Z",
  },
  {
    id: "camp-investor-q3",
    name: "Q3 Investor Update",
    description: "Quarterly progress report covering relay expansion, postage latency improvements, and mailbox growth.",
    groupId: "group-newsletter",
    audienceId: "investors",
    status: "draft",
    tags: ["newsletter", "announcement"],
    messageIds: ["msg-investor-q3-1"],
    createdAt: "2026-06-10T09:00:00Z",
    updatedAt: "2026-06-17T10:00:00Z",
  },
  {
    id: "camp-relay-digest",
    name: "Relay Operator Digest",
    description: "Monthly operational summary for active relay node operators covering uptime, earnings, and protocol changes.",
    groupId: "group-newsletter",
    audienceId: "relay-operators",
    status: "needs-review",
    tags: ["newsletter", "stellar", "announcement"],
    messageIds: ["msg-relay-digest-1"],
    createdAt: "2026-06-05T08:00:00Z",
    updatedAt: "2026-06-15T08:00:00Z",
  },
  {
    id: "camp-passphrase-confirm",
    name: "Passphrase Confirmation",
    description: "Security alert requesting passphrase confirmation when a new device login is detected.",
    groupId: "group-security",
    audienceId: "founders",
    status: "active",
    tags: ["security", "alert"],
    messageIds: ["msg-passphrase-1"],
    createdAt: "2026-06-01T07:00:00Z",
    updatedAt: "2026-06-15T09:30:00Z",
  },
  {
    id: "camp-cold-outreach-notice",
    name: "Cold Outreach Policy Notice",
    description: "Automated notice sent to unknown senders explaining postage verification requirements.",
    groupId: "group-security",
    audienceId: "unknown-senders",
    status: "draft",
    tags: ["security", "alert"],
    messageIds: ["msg-cold-outreach-1"],
    createdAt: "2026-06-01T07:30:00Z",
    updatedAt: "2026-06-14T16:00:00Z",
  },
  {
    id: "camp-summit-invite",
    name: "Stellar Summit Invite",
    description: "Event invitation and logistics digest for registered Stellar Summit 2026 attendees.",
    groupId: "group-events",
    audienceId: "events",
    status: "active",
    tags: ["announcement", "marketing"],
    messageIds: ["msg-summit-1"],
    createdAt: "2026-06-08T10:00:00Z",
    updatedAt: "2026-06-16T14:00:00Z",
  },
];

// ---------------------------------------------------------------------------
// Campaign Message Links
// ---------------------------------------------------------------------------

export const campaignMessageLinks: CampaignMessageLink[] = [
  { campaignId: "camp-welcome", messageId: "msg-welcome-1", role: "primary", sequenceIndex: 0 },
  { campaignId: "camp-welcome", messageId: "msg-welcome-2", role: "followup", sequenceIndex: 1 },
  { campaignId: "camp-wallet-setup", messageId: "msg-wallet-1", role: "notification", sequenceIndex: 0 },
  { campaignId: "camp-investor-q3", messageId: "msg-investor-q3-1", role: "primary", sequenceIndex: 0 },
  { campaignId: "camp-relay-digest", messageId: "msg-relay-digest-1", role: "primary", sequenceIndex: 0 },
  { campaignId: "camp-passphrase-confirm", messageId: "msg-passphrase-1", role: "notification", sequenceIndex: 0 },
  { campaignId: "camp-cold-outreach-notice", messageId: "msg-cold-outreach-1", role: "notification", sequenceIndex: 0 },
  { campaignId: "camp-summit-invite", messageId: "msg-summit-1", role: "primary", sequenceIndex: 0 },
];

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export const CAMPAIGN_GROUPS_BY_ID: Record<string, CampaignGroup> = Object.fromEntries(
  campaignGroups.map((g) => [g.id, g]),
);

export const CAMPAIGN_RECORDS_BY_ID: Record<string, CampaignRecord> = Object.fromEntries(
  campaignRecords.map((r) => [r.id, r]),
);

// ---------------------------------------------------------------------------
// Relationship map examples
// ---------------------------------------------------------------------------

/**
 * Pre-resolved relationship maps for the two primary active campaigns.
 * These illustrate how campaign records, groups, audiences, and messages
 * connect without requiring a runtime join.
 */
export const campaignRelationshipExamples: CampaignRelationshipMap[] = [
  {
    campaign: CAMPAIGN_RECORDS_BY_ID["camp-welcome"],
    group: CAMPAIGN_GROUPS_BY_ID["group-onboarding"],
    audienceLabel: "Founders",
    audienceSize: 210,
    messageLinks: campaignMessageLinks.filter((l) => l.campaignId === "camp-welcome"),
  },
  {
    campaign: CAMPAIGN_RECORDS_BY_ID["camp-summit-invite"],
    group: CAMPAIGN_GROUPS_BY_ID["group-events"],
    audienceLabel: "Event Attendees",
    audienceSize: 580,
    messageLinks: campaignMessageLinks.filter((l) => l.campaignId === "camp-summit-invite"),
  },
];
