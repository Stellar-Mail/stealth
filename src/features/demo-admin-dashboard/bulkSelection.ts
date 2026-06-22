import type { Draft } from "./types/draft";

export type BulkSelectionMode = "replace" | "add" | "remove" | "toggle";

export interface BulkSelectionState {
  selectedIds: string[];
  lastFocusedId: string | null;
}

export interface BulkSelectionSummary {
  totalCount: number;
  selectedCount: number;
  allSelected: boolean;
  partiallySelected: boolean;
}

export const emptyBulkSelection: BulkSelectionState = {
  selectedIds: [],
  lastFocusedId: null,
};

function getDraftIds(drafts: Draft[]): string[] {
  return drafts.map((draft) => draft.id);
}

function sortIdsByDraftOrder(ids: Iterable<string>, drafts: Draft[]): string[] {
  const selected = new Set(ids);
  return getDraftIds(drafts).filter((id) => selected.has(id));
}

export function normalizeSelectedDraftIds(drafts: Draft[], selectedIds: string[]): string[] {
  return sortIdsByDraftOrder(selectedIds, drafts);
}

export function getBulkSelectionSummary(
  drafts: Draft[],
  selectedIds: string[],
): BulkSelectionSummary {
  const selectedCount = normalizeSelectedDraftIds(drafts, selectedIds).length;
  const totalCount = drafts.length;

  return {
    totalCount,
    selectedCount,
    allSelected: totalCount > 0 && selectedCount === totalCount,
    partiallySelected: selectedCount > 0 && selectedCount < totalCount,
  };
}

export function selectAllDrafts(drafts: Draft[]): BulkSelectionState {
  const selectedIds = getDraftIds(drafts);
  return {
    selectedIds,
    lastFocusedId: selectedIds.at(-1) ?? null,
  };
}

export function clearBulkSelection(): BulkSelectionState {
  return emptyBulkSelection;
}

export function selectDraftRange(
  drafts: Draft[],
  startId: string,
  endId: string,
): BulkSelectionState {
  const ids = getDraftIds(drafts);
  const start = ids.indexOf(startId);
  const end = ids.indexOf(endId);

  if (start === -1 || end === -1) {
    return clearBulkSelection();
  }

  const from = Math.min(start, end);
  const to = Math.max(start, end);
  return {
    selectedIds: ids.slice(from, to + 1),
    lastFocusedId: endId,
  };
}

export function updateBulkSelection(
  drafts: Draft[],
  currentSelectedIds: string[],
  targetIds: string[],
  mode: BulkSelectionMode,
): BulkSelectionState {
  const draftIds = new Set(getDraftIds(drafts));
  const cleanTargets = targetIds.filter((id) => draftIds.has(id));
  const selected = new Set(normalizeSelectedDraftIds(drafts, currentSelectedIds));

  if (mode === "replace") {
    return {
      selectedIds: sortIdsByDraftOrder(cleanTargets, drafts),
      lastFocusedId: cleanTargets.at(-1) ?? null,
    };
  }

  for (const id of cleanTargets) {
    if (mode === "add") {
      selected.add(id);
    } else if (mode === "remove") {
      selected.delete(id);
    } else if (selected.has(id)) {
      selected.delete(id);
    } else {
      selected.add(id);
    }
  }

  return {
    selectedIds: sortIdsByDraftOrder(selected, drafts),
    lastFocusedId: cleanTargets.at(-1) ?? null,
  };
}

export function invertBulkSelection(drafts: Draft[], selectedIds: string[]): BulkSelectionState {
  const selected = new Set(normalizeSelectedDraftIds(drafts, selectedIds));
  const inverted = getDraftIds(drafts).filter((id) => !selected.has(id));
  return {
    selectedIds: inverted,
    lastFocusedId: inverted.at(-1) ?? null,
  };
}

export function formatBulkSelectionSummary(summary: BulkSelectionSummary): string {
  if (summary.totalCount === 0) {
    return "No draft messages available.";
  }

  if (summary.selectedCount === 0) {
    return `No draft messages selected out of ${summary.totalCount}.`;
  }

  if (summary.allSelected) {
    return `All ${summary.totalCount} draft messages selected.`;
  }

  return `${summary.selectedCount} of ${summary.totalCount} draft messages selected.`;
}
