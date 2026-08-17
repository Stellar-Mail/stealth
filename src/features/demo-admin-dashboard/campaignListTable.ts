import type { CampaignSnapshot } from "./types/campaignSnapshot";

export type CampaignListSortKey = "name" | "targetAudience" | "status" | "drafts" | "updated";

export type CampaignListSortDirection = "asc" | "desc";

export interface CampaignListSort {
  key: CampaignListSortKey;
  direction: CampaignListSortDirection;
}

export interface CampaignListRow {
  id: string;
  name: string;
  targetAudience: string;
  status: NonNullable<CampaignSnapshot["status"]>;
  tags: string[];
  draftCount: number;
  updatedAt: string;
  selected: boolean;
}

export interface CampaignListSelectionSummary {
  selectedCount: number;
  totalCount: number;
  selectedIds: string[];
  hasSelection: boolean;
}

export const defaultCampaignListSort: CampaignListSort = {
  key: "updated",
  direction: "desc",
};

export function buildCampaignListRows(
  campaigns: CampaignSnapshot[],
  selectedIds: string[] = [],
  sort: CampaignListSort = defaultCampaignListSort,
): CampaignListRow[] {
  const selected = new Set(selectedIds);
  return campaigns
    .map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      targetAudience: campaign.targetAudience,
      status: campaign.status ?? "draft",
      tags: [...campaign.tags].sort(),
      draftCount: campaign.drafts.length,
      updatedAt: campaign.timestamp,
      selected: selected.has(campaign.id),
    }))
    .sort((left, right) => compareCampaignRows(left, right, sort));
}

export function toggleCampaignSelection(selectedIds: string[], campaignId: string): string[] {
  const selected = new Set(selectedIds);
  if (selected.has(campaignId)) {
    selected.delete(campaignId);
  } else {
    selected.add(campaignId);
  }
  return Array.from(selected).sort();
}

export function selectAllCampaigns(campaigns: CampaignSnapshot[]): string[] {
  return campaigns.map((campaign) => campaign.id).sort();
}

export function clearCampaignSelection(): string[] {
  return [];
}

export function summarizeCampaignSelection(
  campaigns: CampaignSnapshot[],
  selectedIds: string[],
): CampaignListSelectionSummary {
  const campaignIds = new Set(campaigns.map((campaign) => campaign.id));
  const selected = selectedIds.filter((id) => campaignIds.has(id)).sort();

  return {
    selectedCount: selected.length,
    totalCount: campaigns.length,
    selectedIds: selected,
    hasSelection: selected.length > 0,
  };
}

export function nextCampaignListSort(
  current: CampaignListSort,
  key: CampaignListSortKey,
): CampaignListSort {
  if (current.key !== key) {
    return { key, direction: key === "updated" || key === "drafts" ? "desc" : "asc" };
  }

  return {
    key,
    direction: current.direction === "asc" ? "desc" : "asc",
  };
}

function compareCampaignRows(
  left: CampaignListRow,
  right: CampaignListRow,
  sort: CampaignListSort,
): number {
  const multiplier = sort.direction === "asc" ? 1 : -1;

  if (sort.key === "drafts") {
    return (left.draftCount - right.draftCount || left.name.localeCompare(right.name)) * multiplier;
  }

  if (sort.key === "updated") {
    return (Date.parse(left.updatedAt) - Date.parse(right.updatedAt)) * multiplier;
  }

  return String(left[sort.key]).localeCompare(String(right[sort.key])) * multiplier;
}
