import { useCallback, useMemo, useReducer } from "react";
import type { Draft } from "../types/draft";
import type { DraftDatasetFilters, DraftDatasetState } from "../types/draftDataset";
import { draftDatasetReducer, initialDraftDatasetState } from "../reducers/draftDatasetReducer";
import {
  selectAllDrafts,
  selectDraftCount,
  selectFilteredDrafts,
  selectIsEmpty,
  selectSelectedDraft,
} from "../selectors/draftDatasetSelectors";

export interface UseDraftDatasetResult {
  state: DraftDatasetState;
  drafts: Draft[];
  count: number;
  isEmpty: boolean;
  selectedDraft: Draft | null;
  loadDataset: (drafts: Draft[]) => void;
  addDraft: (draft: Draft) => void;
  updateDraft: (id: string, changes: Partial<Omit<Draft, "id">>) => void;
  removeDraft: (id: string) => void;
  selectDraft: (id: string | null) => void;
  clearDataset: () => void;
  getFilteredDrafts: (filters: DraftDatasetFilters) => Draft[];
}

/**
 * React wrapper around the draft dataset reducer. Exposes the current state plus
 * stable, bound action dispatchers and selector helpers for dashboard UI.
 */
export function useDraftDataset(initialDrafts: Draft[] = []): UseDraftDatasetResult {
  const [state, dispatch] = useReducer(
    draftDatasetReducer,
    initialDrafts,
    (drafts): DraftDatasetState =>
      drafts.length > 0 ? { drafts: [...drafts], selectedId: null } : initialDraftDatasetState,
  );

  const loadDataset = useCallback(
    (drafts: Draft[]) => dispatch({ type: "loadDataset", payload: drafts }),
    [],
  );
  const addDraft = useCallback(
    (draft: Draft) => dispatch({ type: "addDraft", payload: draft }),
    [],
  );
  const updateDraft = useCallback(
    (id: string, changes: Partial<Omit<Draft, "id">>) =>
      dispatch({ type: "updateDraft", payload: { id, changes } }),
    [],
  );
  const removeDraft = useCallback(
    (id: string) => dispatch({ type: "removeDraft", payload: { id } }),
    [],
  );
  const selectDraft = useCallback(
    (id: string | null) => dispatch({ type: "selectDraft", payload: { id } }),
    [],
  );
  const clearDataset = useCallback(() => dispatch({ type: "clearDataset" }), []);
  const getFilteredDrafts = useCallback(
    (filters: DraftDatasetFilters) => selectFilteredDrafts(state, filters),
    [state],
  );

  return useMemo(
    () => ({
      state,
      drafts: selectAllDrafts(state),
      count: selectDraftCount(state),
      isEmpty: selectIsEmpty(state),
      selectedDraft: selectSelectedDraft(state),
      loadDataset,
      addDraft,
      updateDraft,
      removeDraft,
      selectDraft,
      clearDataset,
      getFilteredDrafts,
    }),
    [
      state,
      loadDataset,
      addDraft,
      updateDraft,
      removeDraft,
      selectDraft,
      clearDataset,
      getFilteredDrafts,
    ],
  );
}
