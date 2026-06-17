export interface Draft {
  id: string;
  subject: string;
  body: string;
  recipients: string[];
}

export interface DraftState {
  current: Draft | null;
}

export type DraftAction =
  | { type: "loadDraft"; payload: Draft }
  | { type: "editDraft"; payload: Partial<Draft> }
  | { type: "resetDraft" };
