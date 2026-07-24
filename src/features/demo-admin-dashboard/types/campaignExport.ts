import type { Draft } from "./draft";
import type { CampaignSnapshot } from "./campaignSnapshot";

/** Current schema version for an exported campaign snapshot payload. */
export const CAMPAIGN_EXPORT_SCHEMA_VERSION = 1;

/** Snapshot input accepted by export helpers; status may be absent on legacy data. */
export type CampaignSnapshotExportInput = Omit<CampaignSnapshot, "status"> & {
  status?: CampaignSnapshot["status"];
};

/**
 * Campaign metadata included in an export, kept separate from the drafts so the
 * envelope stays easy to review and re-import.
 */
export interface CampaignExportMeta {
  id: string;
  name: string;
  description: string;
  targetAudience: string;
  status: NonNullable<CampaignSnapshot["status"]>;
  /** Tags, de-duplicated and sorted for stable output. */
  tags: string[];
}

/**
 * Serializable envelope produced when a maintainer exports a campaign snapshot
 * as JSON. The payload is intentionally free of timestamps so the serialized
 * output stays deterministic; the export date lives in the filename.
 */
export interface CampaignSnapshotExport {
  /** Schema version, so future importers can detect the shape. */
  version: number;
  /** Campaign metadata for the exported snapshot. */
  campaign: CampaignExportMeta;
  /** Number of drafts included in the export. */
  draftCount: number;
  /** Exported drafts, sorted by id for stable output. */
  drafts: Draft[];
}
