import type { Draft } from "../types/draft";
import type { CampaignSnapshot } from "../types/campaignSnapshot";
import {
  CAMPAIGN_EXPORT_SCHEMA_VERSION,
  type CampaignSnapshotExport,
  type CampaignSnapshotExportInput,
} from "../types/campaignExport";

const DEFAULT_INDENT = 2;
const DEFAULT_FILENAME_PREFIX = "campaign-export";
const DEFAULT_STATUS = "draft" as const;

/** Sort drafts by id and copy only known fields so exports stay stable. */
function normalizeDrafts(drafts: Draft[]): Draft[] {
  return [...drafts]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((draft) => ({
      id: draft.id,
      subject: draft.subject,
      body: draft.body,
      recipients: [...draft.recipients],
    }));
}

/** De-duplicate and sort tags so the serialized output is stable. */
function normalizeTags(tags: string[]): string[] {
  return Array.from(new Set(tags)).sort((a, b) => a.localeCompare(b));
}

/**
 * Build the export envelope from a campaign snapshot. Drafts and tags are
 * sorted deterministically and only known fields are copied, so stray
 * properties never leak into a shared export.
 */
export function buildCampaignExport(snapshot: CampaignSnapshotExportInput): CampaignSnapshotExport {
  const drafts = normalizeDrafts(snapshot.drafts);
  return {
    version: CAMPAIGN_EXPORT_SCHEMA_VERSION,
    campaign: {
      id: snapshot.id,
      name: snapshot.name,
      description: snapshot.description,
      targetAudience: snapshot.targetAudience,
      status: snapshot.status ?? DEFAULT_STATUS,
      tags: normalizeTags(snapshot.tags),
    },
    draftCount: drafts.length,
    drafts,
  };
}

/**
 * Serialize a campaign snapshot to deterministic, pretty-printed JSON. The
 * output ends with a trailing newline so it reads cleanly when written to a file.
 */
export function serializeCampaignSnapshot(
  snapshot: CampaignSnapshotExportInput,
  indent: number = DEFAULT_INDENT,
): string {
  return `${JSON.stringify(buildCampaignExport(snapshot), null, indent)}\n`;
}

/**
 * Build a deterministic export filename of the form
 * `campaign-export-<id>-YYYY-MM-DD.json`. The date is read in UTC and passed in
 * explicitly so callers (and tests) stay deterministic.
 */
export function buildCampaignExportFilename(
  snapshot: CampaignSnapshotExportInput,
  date: Date,
  prefix: string = DEFAULT_FILENAME_PREFIX,
): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${prefix}-${snapshot.id}-${year}-${month}-${day}.json`;
}
