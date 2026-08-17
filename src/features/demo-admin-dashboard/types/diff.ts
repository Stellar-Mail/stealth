/**
 * Types for visual diffing of demo datasets.
 * All implementations must remain safe, fake, and deterministic.
 */

export type DiffType = "added" | "removed" | "changed" | "unchanged";

export interface FieldDiff {
  fieldName: string;
  oldValue: any;
  newValue: any;
  type: DiffType;
}

export interface ItemDiff {
  id: string;
  type: DiffType;
  fields: FieldDiff[];
}

export interface DatasetDiff {
  messages: ItemDiff[];
  senders: ItemDiff[];
  summary: {
    added: number;
    removed: number;
    changed: number;
  };
}
