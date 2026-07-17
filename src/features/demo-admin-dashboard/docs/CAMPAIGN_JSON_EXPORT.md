# Campaign JSON Export

Helpers for serializing a demo campaign snapshot into stable, versioned JSON that a maintainer can review in a pull request and later re-import.

## Goal

Turn a `CampaignSnapshot` (campaign metadata plus its draft messages) into a deterministic JSON envelope. Re-running the export on the same snapshot always produces identical output, which keeps diffs small and reviewable.

## Schema

The envelope is defined in `types/campaignExport.ts`:

- `version` — schema version (`CAMPAIGN_EXPORT_SCHEMA_VERSION`).
- `campaign` — campaign metadata: `id`, `name`, `description`, `targetAudience`, `status`, and `tags`.
- `draftCount` — number of drafts included in the export.
- `drafts` — exported drafts, sorted by `id`.

## Stable ordering and determinism

- Drafts are sorted by `id` (ascending) and reduced to known fields only (`id`, `subject`, `body`, `recipients`).
- Tags are de-duplicated and sorted alphabetically.
- No timestamps are written into the payload; the export date lives in the filename instead, so the JSON body stays deterministic.

## API

- `buildCampaignExport(snapshot)` — builds the export envelope object.
- `serializeCampaignSnapshot(snapshot, indent?)` — returns pretty-printed JSON ending in a newline.
- `buildCampaignExportFilename(snapshot, date, prefix?)` — returns a `campaign-export-<id>-YYYY-MM-DD.json` filename using the UTC date.

## Scope

This is demo-data tooling only. All campaign data is fake and safe for public review, and nothing here is wired into production mail flows.
