import type { DraftDatasetAction, DraftDatasetState } from "../types/draftDataset";

export const initialDraftDatasetState: DraftDatasetState = {
  drafts: [],
  selectedId: null,
};

/**
 * Pure, immutable reducer for the editable draft dataset. Never mutates the
 * incoming state or arrays, so it is safe for React state and deterministic
 * tests.
 */
export function draftDatasetReducer(
  state: DraftDatasetState = initialDraftDatasetState,
  action: DraftDatasetAction,
): DraftDatasetState {
  switch (action.type) {
    case "loadDataset":
      return { drafts: [...action.payload], selectedId: null };
    case "addDraft": {
      // Ignore duplicate ids so the dataset stays clean.
      if (state.drafts.some((draft) => draft.id === action.payload.id)) {
        return state;
      }
      return { ...state, drafts: [...state.drafts, action.payload] };
    }
    case "updateDraft": {
      const { id, changes } = action.payload;
      let changed = false;
      const drafts = state.drafts.map((draft) => {
        if (draft.id !== id) return draft;
        changed = true;
        return { ...draft, ...changes };
      });
      return changed ? { ...state, drafts } : state;
    }
    case "removeDraft": {
      const drafts = state.drafts.filter((draft) => draft.id !== action.payload.id);
      if (drafts.length === state.drafts.length) return state;
      const selectedId = state.selectedId === action.payload.id ? null : state.selectedId;
      return { ...state, drafts, selectedId };
    }
    case "selectDraft": {
      const { id } = action.payload;
      if (id !== null && !state.drafts.some((draft) => draft.id === id)) {
        return state;
      }
      return { ...state, selectedId: id };
    }
    case "clearDataset":
      return { drafts: [], selectedId: null };
    default:
      return state;
  }
}
