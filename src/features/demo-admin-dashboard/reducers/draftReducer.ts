import { DraftState, DraftAction } from "../types/draft";

export const initialState: DraftState = {
  current: null,
};

export function draftReducer(state: DraftState = initialState, action: DraftAction): DraftState {
  switch (action.type) {
    case "loadDraft":
      return { current: action.payload };
    case "editDraft":
      if (!state.current) return state;
      return { current: { ...state.current, ...action.payload } };
    case "resetDraft":
      return { current: null };
    default:
      return state;
  }
}
