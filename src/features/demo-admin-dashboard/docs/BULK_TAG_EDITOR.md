# Bulk Tag Editor

Lets an admin add or remove campaign tags across multiple selected campaigns at
once, with duplicate prevention and an audit summary of what changed.

All logic and UI live inside `src/features/demo-admin-dashboard/` and operate on
fake, deterministic demo data (`CampaignSnapshot[]`). Nothing here touches real
mail flows, network calls, or data outside this folder.

## Pieces

- `bulkTagEditor.ts` — pure, immutable helpers:
  - `normalizeTag` / `normalizeTags` / `parseTagInput` — normalize (lowercase +
    trim), drop blanks, and de-duplicate tag input.
  - `applyBulkTagEdit(campaigns, selectedIds, tags, operation)` — returns a new
    campaign list plus a per-campaign change log and an audit summary. Inputs
    are never mutated.
  - `summarizeBulkTagEdit(result)` — a one-line human summary.
- `components/BulkTagEditor.tsx` — selection list, tag input, Add/Remove
  buttons, and a rendered audit summary using the existing tag color tokens.

## Duplicate prevention

- **Add:** a tag already present on a campaign is skipped (never duplicated).
- **Remove:** a tag not present on a campaign is skipped.

Skipped tags are reported per campaign and counted in the audit summary.

## Audit summary

`applyBulkTagEdit` returns a `summary` with the operation, number of selected
and affected campaigns, and totals for applied vs skipped tags. Example line:
`Added 2 tags across 3 campaigns (1 skipped as duplicates).`

## Follow-up

Wiring this component into the main dashboard view is intentionally left as a
follow-up so this change stays scoped and independently reviewable.
