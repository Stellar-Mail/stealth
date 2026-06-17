import type { CampaignTag, TagColorKey } from "../types/campaignTag";
import type { CampaignSnapshot } from "../types/campaignSnapshot";

type CreateResult = { ok: true; tags: CampaignTag[] } | { ok: false; error: string };

type RenameResult = { ok: true; tags: CampaignTag[] } | { ok: false; error: string };

export function createTag(tags: CampaignTag[], name: string, color: TagColorKey): CreateResult {
  const normalized = name.toLowerCase().trim();
  if (!normalized) return { ok: false, error: "Tag name cannot be empty." };
  const duplicate = tags.some((t) => t.name.toLowerCase() === normalized);
  if (duplicate) return { ok: false, error: `A tag named "${name}" already exists.` };
  const newTag: CampaignTag = {
    id: `tag-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim(),
    color,
  };
  return { ok: true, tags: [...tags, newTag] };
}

export function renameTag(tags: CampaignTag[], id: string, name: string): RenameResult {
  const normalized = name.toLowerCase().trim();
  if (!normalized) return { ok: false, error: "Tag name cannot be empty." };
  const duplicate = tags.some((t) => t.id !== id && t.name.toLowerCase() === normalized);
  if (duplicate) return { ok: false, error: `A tag named "${name}" already exists.` };
  return {
    ok: true,
    tags: tags.map((t) => (t.id === id ? { ...t, name: name.trim() } : t)),
  };
}

export function updateTagColor(tags: CampaignTag[], id: string, color: TagColorKey): CampaignTag[] {
  return tags.map((t) => (t.id === id ? { ...t, color } : t));
}

export function mergeTag(
  tags: CampaignTag[],
  snapshots: CampaignSnapshot[],
  sourceId: string,
  targetId: string,
): { tags: CampaignTag[]; snapshots: CampaignSnapshot[] } {
  const source = tags.find((t) => t.id === sourceId);
  const target = tags.find((t) => t.id === targetId);
  if (!source || !target) return { tags, snapshots };

  const nextTags = tags.filter((t) => t.id !== sourceId);
  const nextSnapshots = snapshots.map((snap) => ({
    ...snap,
    tags: snap.tags.map((tagName) => (tagName === source.name ? target.name : tagName)),
  }));

  return { tags: nextTags, snapshots: nextSnapshots };
}

export function deleteTag(
  tags: CampaignTag[],
  snapshots: CampaignSnapshot[],
  id: string,
): { tags: CampaignTag[]; snapshots: CampaignSnapshot[] } {
  const tag = tags.find((t) => t.id === id);
  if (!tag) return { tags, snapshots };

  const nextTags = tags.filter((t) => t.id !== id);
  const nextSnapshots = snapshots.map((snap) => ({
    ...snap,
    tags: snap.tags.filter((tagName) => tagName !== tag.name),
  }));

  return { tags: nextTags, snapshots: nextSnapshots };
}

export function getTagUsageCount(snapshots: CampaignSnapshot[], tagName: string): number {
  return snapshots.filter((snap) => snap.tags.includes(tagName)).length;
}
