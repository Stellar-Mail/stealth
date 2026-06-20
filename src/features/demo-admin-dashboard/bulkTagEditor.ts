import type { CampaignSnapshot } from "./types/campaignSnapshot";

/**
 * Bulk tag editor logic for the demo admin dashboard.
 *
 * Pure, deterministic helpers that add or remove tags across many campaigns
 * at once, prevent duplicate tags, and produce an audit summary describing
 * exactly what changed. Inputs are never mutated.
 */

export type BulkTagOperation = "add" | "remove";

export interface BulkTagCampaignChange {
  id: string;
  name: string;
  applied: string[];
  skipped: string[];
}

export interface BulkTagAuditSummary {
  operation: BulkTagOperation;
  selectedCount: number;
  affectedCount: number;
  totalApplied: number;
  totalSkipped: number;
}

export interface BulkTagEditResult {
  campaigns: CampaignSnapshot[];
  operation: BulkTagOperation;
  requestedTags: string[];
  changes: BulkTagCampaignChange[];
  summary: BulkTagAuditSummary;
}

export function normalizeTag(tag: string): string {
  return tag.toLowerCase().trim();
}

export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tags) {
    const tag = normalizeTag(raw);
    if (tag.length === 0 || seen.has(tag)) {
      continue;
    }
    seen.add(tag);
    result.push(tag);
  }
  return result;
}

export function parseTagInput(input: string): string[] {
  return normalizeTags(input.split(/[\s,]+/));
}

export function applyBulkTagEdit(
  campaigns: CampaignSnapshot[],
  selectedIds: string[],
  tags: string[],
  operation: BulkTagOperation,
): BulkTagEditResult {
  const requestedTags = normalizeTags(tags);
  const selected = new Set(selectedIds);
  const changes: BulkTagCampaignChange[] = [];

  const nextCampaigns = campaigns.map((campaign) => {
    if (!selected.has(campaign.id)) {
      return campaign;
    }

    const existing = (campaign.tags ?? []).map(normalizeTag);
    const existingSet = new Set(existing);
    const applied: string[] = [];
    const skipped: string[] = [];

    if (operation === "add") {
      const nextTags = [...existing];
      for (const tag of requestedTags) {
        if (existingSet.has(tag)) {
          skipped.push(tag);
        } else {
          existingSet.add(tag);
          nextTags.push(tag);
          applied.push(tag);
        }
      }
      changes.push({ id: campaign.id, name: campaign.name, applied, skipped });
      return applied.length === 0 ? campaign : { ...campaign, tags: nextTags };
    }

    const removeSet = new Set(requestedTags);
    for (const tag of requestedTags) {
      if (existingSet.has(tag)) {
        applied.push(tag);
      } else {
        skipped.push(tag);
      }
    }
    changes.push({ id: campaign.id, name: campaign.name, applied, skipped });
    return applied.length === 0
      ? campaign
      : { ...campaign, tags: existing.filter((tag: string) => !removeSet.has(tag)) };
  });

  const affectedCount = changes.filter((change) => change.applied.length > 0).length;
  const totalApplied = changes.reduce((sum, change) => sum + change.applied.length, 0);
  const totalSkipped = changes.reduce((sum, change) => sum + change.skipped.length, 0);

  return {
    campaigns: nextCampaigns,
    operation,
    requestedTags,
    changes,
    summary: {
      operation,
      selectedCount: changes.length,
      affectedCount,
      totalApplied,
      totalSkipped,
    },
  };
}

export function summarizeBulkTagEdit(result: BulkTagEditResult): string {
  const { operation, summary } = result;

  if (summary.totalApplied === 0) {
    const reason = operation === "add" ? "all were duplicates" : "none were present";
    return `No changes - ${reason} (${summary.totalSkipped} skipped).`;
  }

  const verb = operation === "add" ? "Added" : "Removed";
  const tagWord = summary.totalApplied === 1 ? "tag" : "tags";
  const campaignWord = summary.affectedCount === 1 ? "campaign" : "campaigns";
  const base = `${verb} ${summary.totalApplied} ${tagWord} across ${summary.affectedCount} ${campaignWord}`;

  if (summary.totalSkipped === 0) {
    return `${base}.`;
  }

  const skipReason = operation === "add" ? "skipped as duplicates" : "skipped (not present)";
  return `${base} (${summary.totalSkipped} ${skipReason}).`;
}
