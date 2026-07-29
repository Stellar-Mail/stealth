import type { ChangelogEntry } from "./types";

/**
 * The localStorage key used to persist the last-seen changelog version.
 */
export const STORAGE_KEY = "stealth:changelog:seen-version";

/**
 * Read the last-seen version from localStorage.
 * Returns `null` when storage is unavailable or the key has never been set.
 */
export function getSeenVersion(): string | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Persist the last-seen version to localStorage.
 * Silently swallows storage errors (e.g. private browsing quota).
 */
export function setSeenVersion(version: string): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, version);
  } catch {
    // ignore — storage may be unavailable in private browsing
  }
}

/**
 * Determine whether a changelog entry should be considered unread
 * given the last version the user acknowledged.
 *
 * When `seenVersion` is `null` (first visit), every entry is unread.
 * Otherwise, an entry is unread when its version string compares
 * greater than the seen version (lexicographic — works for semver
 * with consistent segment counts).
 */
export function isEntryUnread(entryVersion: string, seenVersion: string | null): boolean {
  if (!seenVersion) return true;
  return entryVersion > seenVersion;
}

/**
 * Determine whether any entry in the list is newer than the seen version.
 */
export function hasUnreadEntries(latestVersion: string, seenVersion: string | null): boolean {
  return seenVersion !== latestVersion;
}

/** Key used to group changelog entries by release. */
export type ReleaseGroupKey = string;

/**
 * Group changelog entries by `"version|date"`.
 *
 * Maintains insertion order so the caller receives groups in the same
 * sequence as the source array (typically newest-first).
 */
export function groupEntriesByRelease(
  entries: readonly ChangelogEntry[],
): Record<ReleaseGroupKey, ChangelogEntry[]> {
  return entries.reduce<Record<string, ChangelogEntry[]>>((acc, entry) => {
    const key = `${entry.version}|${entry.date}`;
    (acc[key] ??= []).push(entry);
    return acc;
  }, {});
}

/**
 * Look up the display configuration for a changelog category.
 * Returns `undefined` for unknown categories, letting the caller
 * fall back to a generic badge.
 */
export const CATEGORY_CONFIG: Record<string, { label: string; styles: string }> = {
  ui: {
    label: "UI",
    styles: "bg-sky-400/15 text-sky-300 border-sky-400/20 hover:bg-sky-400/20",
  },
  api: {
    label: "API",
    styles: "bg-violet-400/15 text-violet-300 border-violet-400/20 hover:bg-violet-400/20",
  },
  protocol: {
    label: "Protocol",
    styles: "bg-amber-400/15 text-amber-300 border-amber-400/20 hover:bg-amber-400/20",
  },
  security: {
    label: "Security",
    styles: "bg-rose-400/15 text-rose-300 border-rose-400/20 hover:bg-rose-400/20",
  },
};

/**
 * Resolve the human-readable label for a category, falling back
 * to the raw category string for unknown values.
 */
export function getCategoryLabel(category: string): string {
  return CATEGORY_CONFIG[category]?.label ?? category;
}
