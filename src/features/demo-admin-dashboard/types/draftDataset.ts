import type { Draft } from "./draft";

/**
 * State for the editable draft *dataset* — the collection of drafts a maintainer
 * curates before publishing to the demo UI. Distinct from the single `DraftState`
 * in ./draft, which tracks one `current` draft.
 */
export interface DraftDatasetState {
  /** Working collection of drafts, kept in insertion order. */
  drafts: Draft[];
  /** Id of the draft currently selected for editing, or null. */
  selectedId: string | null;
}

/** Lightweight, feature-local filters for narrowing a draft dataset. */
export interface DraftDatasetFilters {
  /** Case-insensitive text matched against subject, body, and recipients. */
  searchQuery?: string;
  subject?: string;
  body?: string;
  recipient?: string;
}

export type DraftDatasetAction =
  | { type: "loadDataset"; payload: Draft[] }
  | { type: "addDraft"; payload: Draft }
  | {
      type: "updateDraft";
      payload: { id: string; changes: Partial<Omit<Draft, "id">> };
    }
  | { type: "removeDraft"; payload: { id: string } }
  | { type: "selectDraft"; payload: { id: string | null } }
  | { type: "clearDataset" };
