import type { Draft } from "../types/draft";
import type { DraftDatasetState } from "../types/draftDataset";
import { DATASET_EXPORT_SCHEMA_VERSION, type DraftDatasetExport } from "../types/datasetExport";

const DEFAULT_INDENT = 2;
const DEFAULT_FILENAME_PREFIX = "draft-dataset-export";

/**
 * Build the export envelope from a list of drafts. Each draft is normalized to
 * only the known fields, so stray properties never leak into a shared export.
 */
export function buildDatasetExport(drafts: Draft[]): DraftDatasetExport {
  return {
    version: DATASET_EXPORT_SCHEMA_VERSION,
    count: drafts.length,
    drafts: drafts.map((draft) => ({
      id: draft.id,
      subject: draft.subject,
      body: draft.body,
      recipients: [...draft.recipients],
    })),
  };
}

/**
 * Serialize a list of drafts to formatted, deterministic JSON. The output is
 * pretty-printed and ends with a trailing newline so it reads cleanly in files.
 */
export function serializeDraftDataset(drafts: Draft[], indent: number = DEFAULT_INDENT): string {
  return `${JSON.stringify(buildDatasetExport(drafts), null, indent)}\n`;
}

/** Convenience wrapper to serialize directly from dataset state. */
export function serializeDraftDatasetState(
  state: DraftDatasetState,
  indent: number = DEFAULT_INDENT,
): string {
  return serializeDraftDataset(state.drafts, indent);
}

/**
 * Build a deterministic export filename of the form
 * `draft-dataset-export-YYYY-MM-DD.json`. The date is taken in UTC and passed
 * in explicitly so callers (and tests) stay deterministic.
 */
export function buildExportFilename(date: Date, prefix: string = DEFAULT_FILENAME_PREFIX): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${prefix}-${year}-${month}-${day}.json`;
}
