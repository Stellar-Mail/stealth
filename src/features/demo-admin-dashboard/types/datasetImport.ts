import type { Draft } from "./draft";

/**
 * A single problem found while importing a draft dataset. `path` points at the
 * offending location (e.g. "drafts[2].recipients[0]") so the UI can surface a
 * precise, human-readable error.
 */
export interface DatasetImportIssue {
  path: string;
  message: string;
}

/**
 * Result of mapping an imported draft dataset payload. On success, `drafts`
 * holds the normalized, review-safe drafts ready for the `loadDataset` action.
 * On failure, `issues` lists every problem found (the import is rejected whole).
 */
export type DatasetImportResult =
  | { ok: true; drafts: Draft[] }
  | { ok: false; issues: DatasetImportIssue[] };
