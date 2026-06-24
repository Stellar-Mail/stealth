export interface AdminEditHistoryState<T> {
  past: T[];
  present: T;
  future: T[];
  limit: number;
}

export type AdminEditHistoryAction<T> =
  | { type: "push"; payload: T }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset"; payload: T }
  | { type: "setLimit"; payload: number };

export interface AdminEditHistorySummary {
  canUndo: boolean;
  canRedo: boolean;
  undoCount: number;
  redoCount: number;
  limit: number;
}

const DEFAULT_HISTORY_LIMIT = 25;

export function createAdminEditHistory<T>(
  present: T,
  limit = DEFAULT_HISTORY_LIMIT,
): AdminEditHistoryState<T> {
  return {
    past: [],
    present,
    future: [],
    limit: normalizeLimit(limit),
  };
}

export function adminEditHistoryReducer<T>(
  state: AdminEditHistoryState<T>,
  action: AdminEditHistoryAction<T>,
): AdminEditHistoryState<T> {
  switch (action.type) {
    case "push":
      if (Object.is(state.present, action.payload)) {
        return state;
      }
      return {
        ...state,
        past: trimPast([...state.past, state.present], state.limit),
        present: action.payload,
        future: [],
      };
    case "undo": {
      if (state.past.length === 0) {
        return state;
      }
      const previous = state.past[state.past.length - 1];
      return {
        ...state,
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
      };
    }
    case "redo": {
      if (state.future.length === 0) {
        return state;
      }
      const [next, ...future] = state.future;
      return {
        ...state,
        past: trimPast([...state.past, state.present], state.limit),
        present: next,
        future,
      };
    }
    case "reset":
      return createAdminEditHistory(action.payload, state.limit);
    case "setLimit": {
      const limit = normalizeLimit(action.payload);
      return {
        ...state,
        limit,
        past: trimPast(state.past, limit),
      };
    }
    default:
      return state;
  }
}

export function canUndoAdminEdit<T>(state: AdminEditHistoryState<T>): boolean {
  return state.past.length > 0;
}

export function canRedoAdminEdit<T>(state: AdminEditHistoryState<T>): boolean {
  return state.future.length > 0;
}

export function summarizeAdminEditHistory<T>(
  state: AdminEditHistoryState<T>,
): AdminEditHistorySummary {
  return {
    canUndo: canUndoAdminEdit(state),
    canRedo: canRedoAdminEdit(state),
    undoCount: state.past.length,
    redoCount: state.future.length,
    limit: state.limit,
  };
}

function normalizeLimit(limit: number): number {
  if (!Number.isFinite(limit)) {
    return DEFAULT_HISTORY_LIMIT;
  }
  return Math.max(1, Math.floor(limit));
}

function trimPast<T>(past: T[], limit: number): T[] {
  return past.length > limit ? past.slice(past.length - limit) : past;
}
