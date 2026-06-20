import type { Draft } from "./types/draft";
import type { CampaignSnapshot } from "./types/campaignSnapshot";

export type CampaignDiffKind = "added" | "removed" | "changed" | "unchanged";

export type CampaignDiffSection = "metadata" | "tags" | "drafts";

export interface CampaignDiffEntry {
  id: string;
  kind: CampaignDiffKind;
  section: CampaignDiffSection;
  label: string;
  before?: string;
  after?: string;
  detail: string;
}

export interface CampaignDiffSummary {
  added: number;
  removed: number;
  changed: number;
  unchanged: number;
  total: number;
}

export interface CampaignDiffResult {
  baseId: string;
  comparisonId: string;
  entries: CampaignDiffEntry[];
  summary: CampaignDiffSummary;
  hasChanges: boolean;
  canReview: boolean;
}

const metadataFields: Array<{
  key: "name" | "description" | "targetAudience" | "status";
  label: string;
  section: CampaignDiffSection;
}> = [
  { key: "name", label: "Campaign name", section: "metadata" },
  { key: "description", label: "Description", section: "metadata" },
  { key: "targetAudience", label: "Target audience", section: "metadata" },
  { key: "status", label: "Status", section: "metadata" },
];

export function compareCampaignSnapshots(
  base: CampaignSnapshot,
  comparison: CampaignSnapshot,
): CampaignDiffResult {
  const entries: CampaignDiffEntry[] = [
    ...compareMetadata(base, comparison),
    ...compareTags(base.tags, comparison.tags),
    ...compareDrafts(base.drafts, comparison.drafts),
  ];
  const summary = summarizeCampaignDiff(entries);

  return {
    baseId: base.id,
    comparisonId: comparison.id,
    entries,
    summary,
    hasChanges: summary.added + summary.removed + summary.changed > 0,
    canReview: entries.length > 0,
  };
}

export function summarizeCampaignDiff(entries: CampaignDiffEntry[]): CampaignDiffSummary {
  return entries.reduce<CampaignDiffSummary>(
    (summary, entry) => ({
      ...summary,
      [entry.kind]: summary[entry.kind] + 1,
      total: summary.total + 1,
    }),
    { added: 0, removed: 0, changed: 0, unchanged: 0, total: 0 },
  );
}

export function getCampaignDiffEntriesByKind(
  result: CampaignDiffResult,
  kind: CampaignDiffKind,
): CampaignDiffEntry[] {
  return result.entries.filter((entry) => entry.kind === kind);
}

export function formatCampaignDiffSummary(result: CampaignDiffResult): string {
  const { summary } = result;
  const changeCount = summary.added + summary.removed + summary.changed;

  if (changeCount === 0) {
    return "No campaign changes detected.";
  }

  const parts = [
    summary.added > 0 ? `${summary.added} added` : "",
    summary.removed > 0 ? `${summary.removed} removed` : "",
    summary.changed > 0 ? `${summary.changed} changed` : "",
  ].filter(Boolean);

  return `Review ${parts.join(", ")} campaign difference${changeCount === 1 ? "" : "s"}.`;
}

function compareMetadata(
  base: CampaignSnapshot,
  comparison: CampaignSnapshot,
): CampaignDiffEntry[] {
  return metadataFields.map(({ key, label, section }) => {
    const before = normalizeValue(key === "status" ? (base.status ?? "draft") : base[key]);
    const after = normalizeValue(
      key === "status" ? (comparison.status ?? "draft") : comparison[key],
    );
    const changed = before !== after;

    return {
      id: `metadata-${key}`,
      kind: changed ? "changed" : "unchanged",
      section,
      label,
      before,
      after,
      detail: changed ? `${label} changed.` : `${label} is unchanged.`,
    };
  });
}

function compareTags(baseTags: string[], comparisonTags: string[]): CampaignDiffEntry[] {
  const beforeTags = normalizeTagList(baseTags);
  const afterTags = normalizeTagList(comparisonTags);
  const beforeSet = new Set(beforeTags);
  const afterSet = new Set(afterTags);
  const added = afterTags.filter((tag) => !beforeSet.has(tag));
  const removed = beforeTags.filter((tag) => !afterSet.has(tag));

  if (added.length === 0 && removed.length === 0) {
    return [
      {
        id: "tags-unchanged",
        kind: "unchanged",
        section: "tags",
        label: "Tags",
        before: beforeTags.join(", "),
        after: afterTags.join(", "),
        detail: "Tag set is unchanged.",
      },
    ];
  }

  return [
    ...added.map((tag) => ({
      id: `tag-added-${tag}`,
      kind: "added" as const,
      section: "tags" as const,
      label: `Tag: ${tag}`,
      after: tag,
      detail: "Tag added to comparison campaign.",
    })),
    ...removed.map((tag) => ({
      id: `tag-removed-${tag}`,
      kind: "removed" as const,
      section: "tags" as const,
      label: `Tag: ${tag}`,
      before: tag,
      detail: "Tag removed from comparison campaign.",
    })),
  ];
}

function compareDrafts(baseDrafts: Draft[], comparisonDrafts: Draft[]): CampaignDiffEntry[] {
  const entries: CampaignDiffEntry[] = [];
  const baseById = new Map(baseDrafts.map((draft) => [draft.id, draft]));
  const comparisonById = new Map(comparisonDrafts.map((draft) => [draft.id, draft]));
  const draftIds = Array.from(new Set([...baseById.keys(), ...comparisonById.keys()])).sort();

  for (const draftId of draftIds) {
    const before = baseById.get(draftId);
    const after = comparisonById.get(draftId);

    if (!before && after) {
      entries.push({
        id: `draft-added-${draftId}`,
        kind: "added",
        section: "drafts",
        label: `Draft: ${after.subject}`,
        after: describeDraft(after),
        detail: "Draft added to comparison campaign.",
      });
      continue;
    }

    if (before && !after) {
      entries.push({
        id: `draft-removed-${draftId}`,
        kind: "removed",
        section: "drafts",
        label: `Draft: ${before.subject}`,
        before: describeDraft(before),
        detail: "Draft removed from comparison campaign.",
      });
      continue;
    }

    if (!before || !after) {
      continue;
    }

    const beforeDescription = describeDraft(before);
    const afterDescription = describeDraft(after);
    const changed = beforeDescription !== afterDescription;

    entries.push({
      id: `draft-${changed ? "changed" : "unchanged"}-${draftId}`,
      kind: changed ? "changed" : "unchanged",
      section: "drafts",
      label: `Draft: ${after.subject || before.subject || draftId}`,
      before: beforeDescription,
      after: afterDescription,
      detail: changed ? "Draft content or recipients changed." : "Draft is unchanged.",
    });
  }

  return entries;
}

function normalizeValue(value: string | undefined): string {
  return (value ?? "").trim();
}

function normalizeTagList(tags: string[]): string[] {
  return Array.from(new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))).sort();
}

function describeDraft(draft: Draft): string {
  return [
    normalizeValue(draft.subject),
    normalizeValue(draft.body),
    draft.recipients
      .map((recipient) => recipient.trim().toLowerCase())
      .sort()
      .join(","),
  ].join("\n---\n");
}
