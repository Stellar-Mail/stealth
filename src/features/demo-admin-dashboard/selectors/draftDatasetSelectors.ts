import type { Draft } from "../types/draft";
import type { DraftDatasetFilters, DraftDatasetState } from "../types/draftDataset";

function includesText(value: string, term: string): boolean {
  return value.toLowerCase().includes(term.toLowerCase());
}

function matchesFilters(draft: Draft, filters: DraftDatasetFilters): boolean {
  if (filters.searchQuery && filters.searchQuery.trim() !== "") {
    const term = filters.searchQuery.trim();
    const haystack = [draft.subject, draft.body, ...draft.recipients].join(" ");
    if (!includesText(haystack, term)) return false;
  }
  if (filters.subject && !includesText(draft.subject, filters.subject)) {
    return false;
  }
  if (filters.body && !includesText(draft.body, filters.body)) {
    return false;
  }
  if (filters.recipient) {
    const recipientTerm = filters.recipient;
    if (!draft.recipients.some((recipient) => includesText(recipient, recipientTerm))) {
      return false;
    }
  }
  return true;
}

export function selectAllDrafts(state: DraftDatasetState): Draft[] {
  return state.drafts;
}

export function selectDraftCount(state: DraftDatasetState): number {
  return state.drafts.length;
}

export function selectIsEmpty(state: DraftDatasetState): boolean {
  return state.drafts.length === 0;
}

export function selectDraftById(state: DraftDatasetState, id: string): Draft | undefined {
  return state.drafts.find((draft) => draft.id === id);
}

export function selectSelectedDraft(state: DraftDatasetState): Draft | null {
  if (state.selectedId === null) return null;
  return state.drafts.find((draft) => draft.id === state.selectedId) ?? null;
}

export function selectFilteredDrafts(
  state: DraftDatasetState,
  filters: DraftDatasetFilters,
): Draft[] {
  return state.drafts.filter((draft) => matchesFilters(draft, filters));
}
