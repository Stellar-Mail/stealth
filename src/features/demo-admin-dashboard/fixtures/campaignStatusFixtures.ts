import type { CampaignStatusRecord } from "../types/campaignStatus";

export const demoCampaignStatusRecords: CampaignStatusRecord[] = [
  {
    id: "camp-draft-01",
    name: "Q3 Product Launch",
    description:
      "Initial draft for the Q3 product launch campaign. Targeting early adopters.",
    status: "draft",
    tags: ["marketing", "announcement"],
    createdAt: "2026-06-10T08:00:00Z",
    updatedAt: "2026-06-12T14:30:00Z",
  },
  {
    id: "camp-ready-01",
    name: "Security Advisory",
    description:
      "Security best-practices advisory for high-value accounts. Ready for manager review.",
    status: "ready",
    tags: ["security", "alert"],
    createdAt: "2026-06-08T09:00:00Z",
    updatedAt: "2026-06-14T10:00:00Z",
  },
  {
    id: "camp-active-01",
    name: "Welcome Onboarding Series",
    description:
      "Active onboarding sequence for new signups. Sending in batches.",
    status: "active",
    tags: ["onboarding", "welcome", "stellar"],
    createdAt: "2026-06-01T12:00:00Z",
    updatedAt: "2026-06-17T08:00:00Z",
  },
  {
    id: "camp-paused-01",
    name: "June Newsletter",
    description:
      "Monthly newsletter paused pending content review from the editorial team.",
    status: "paused",
    tags: ["newsletter", "marketing"],
    createdAt: "2026-06-05T11:00:00Z",
    updatedAt: "2026-06-15T16:45:00Z",
  },
  {
    id: "camp-archived-01",
    name: "Legacy Relay Migration",
    description:
      "Completed migration campaign for legacy relay operators. No longer active.",
    status: "archived",
    tags: ["announcement"],
    createdAt: "2026-05-01T07:00:00Z",
    updatedAt: "2026-05-30T18:00:00Z",
  },
  {
    id: "camp-failed-01",
    name: "Testnet Incentive Round",
    description:
      "Failed due to relay connectivity issues. Scheduled for retry after network audit.",
    status: "failed",
    tags: ["marketing", "announcement"],
    createdAt: "2026-06-12T10:00:00Z",
    updatedAt: "2026-06-13T09:15:00Z",
  },
];

export function getCampaignStatusRecordById(
  id: string,
): CampaignStatusRecord | undefined {
  return demoCampaignStatusRecords.find((r) => r.id === id);
}

export function getCampaignsByStatus(
  status: CampaignStatusRecord["status"],
): CampaignStatusRecord[] {
  return demoCampaignStatusRecords.filter((r) => r.status === status);
}
