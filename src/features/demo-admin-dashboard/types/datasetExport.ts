import type { Draft } from "./draft";

/** Current schema version for an exported draft dataset payload. */
export const DATASET_EXPORT_SCHEMA_VERSION = 1;

/**
 * Serializable envelope produced when a maintainer exports the current draft
 * dataset as JSON. The payload is intentionally free of timestamps so the
 * serialized output stays deterministic; the export date lives in the filename.
 */
export interface DraftDatasetExport {
  /** Schema version, so future importers can detect the shape. */
  version: number;
  /** Number of drafts included in the export. */
  count: number;
  /** Exported drafts, in dataset order. */
  drafts: Draft[];
}
