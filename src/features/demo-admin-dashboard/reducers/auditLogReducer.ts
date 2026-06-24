import { createAuditEntry, type AuditLogEntry } from "../auditLog";

export interface AuditLogState {
  entries: AuditLogEntry[];
}

export type AuditLogAction =
  | { type: "record"; payload: Omit<AuditLogEntry, "id"> }
  | { type: "add"; payload: AuditLogEntry }
  | { type: "clear" }
  | { type: "reset"; payload: AuditLogEntry[] };

export const initialAuditLogState: AuditLogState = {
  entries: [],
};

/**
 * Reducer for the demo admin audit log. Keeps entries newest-first so the
 * AuditLogPanel can render the most recent activity at the top.
 */
export function auditLogReducer(
  state: AuditLogState = initialAuditLogState,
  action: AuditLogAction,
): AuditLogState {
  switch (action.type) {
    case "record": {
      const entry = createAuditEntry(action.payload);
      return { entries: [entry, ...state.entries] };
    }
    case "add":
      return { entries: [action.payload, ...state.entries] };
    case "clear":
      return { entries: [] };
    case "reset":
      return { entries: [...action.payload] };
    default:
      return state;
  }
}

/**
 * Returns the most recent entries, up to the provided limit.
 */
export function selectRecentAuditEntries(state: AuditLogState, limit: number): AuditLogEntry[] {
  if (limit <= 0) {
    return [];
  }
  return state.entries.slice(0, limit);
}
