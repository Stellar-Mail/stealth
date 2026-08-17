import { TAG_COLOR_TOKENS } from "../constants/displayTokens";
import type { CampaignTag, TagColorKey } from "../types/campaignTag";

const VALID_TAG_COLORS = new Set<string>(Object.keys(TAG_COLOR_TOKENS));

export function normalizeTagName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function toTagSlug(name: string): string {
  return normalizeTagName(name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function resolveTagSlug(name: string, existingSlugs: string[]): string {
  const base = toTagSlug(name);
  if (!existingSlugs.includes(base)) return base;
  let counter = 2;
  while (existingSlugs.includes(`${base}-${counter}`)) counter++;
  return `${base}-${counter}`;
}

export function normalizeTagColor(color: unknown): TagColorKey {
  if (typeof color === "string" && VALID_TAG_COLORS.has(color)) {
    return color as TagColorKey;
  }
  return "default";
}

export function assignTagOrders(tags: CampaignTag[]): CampaignTag[] {
  return [...tags]
    .sort((a, b) => normalizeTagName(a.name).localeCompare(normalizeTagName(b.name)))
    .map((tag, i) => ({ ...tag, order: i + 1 }));
}

export function normalizeCampaignTag(tag: CampaignTag, existingSlugs: string[] = []): CampaignTag {
  return {
    ...tag,
    name: normalizeTagName(tag.name),
    slug: resolveTagSlug(tag.name, existingSlugs),
    color: normalizeTagColor(tag.color),
  };
}

export function normalizeCampaignTags(tags: CampaignTag[]): CampaignTag[] {
  const slugs: string[] = [];
  const normalized = tags.map((tag) => {
    const result = normalizeCampaignTag(tag, slugs);
    if (result.slug) slugs.push(result.slug);
    return result;
  });
  return assignTagOrders(normalized);
}
