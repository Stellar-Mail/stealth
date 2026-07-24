# Draft Dataset JSON Import (Issue #272)

Maps an imported campaign/draft dataset JSON payload into the local demo admin
draft dataset, safely and deterministically. This is the inverse of the draft
dataset JSON export (issue #190).

## Goal

Take JSON that a maintainer pastes or uploads and turn it into review-safe
`Draft[]` that can be loaded into the draft dataset store via the `loadDataset`
action — without ever importing unsafe or malformed data.

## API

- `parseDatasetImport(raw: string): DatasetImportResult` — parse a raw JSON
  string. Invalid JSON is reported as an issue, never thrown.
- `mapImportedDataset(payload: unknown): DatasetImportResult` — validate and
  normalize an already-parsed payload.

`DatasetImportResult` is a discriminated union:

- `{ ok: true; drafts: Draft[] }` — import succeeded.
- `{ ok: false; issues: DatasetImportIssue[] }` — import rejected; each issue
  has a `path` (e.g. `drafts[2].recipients[0]`) and a human-readable `message`.

## Validation rules

- Payload must be a JSON object.
- `version` must equal `DATASET_EXPORT_SCHEMA_VERSION` (currently `1`).
- `drafts` must be an array; `count` (if present) must match its length.
- Each draft needs a non-empty `id`, string `subject`, string `body`, and a
  `recipients` array.
- Every recipient must be a safe demo address (`@example.com`, `@example.org`,
  or `*stealth.demo`).
- Draft ids must be unique.
- Unknown fields on a draft are stripped from the result.

The import is **atomic**: if any issue is found, no drafts are returned.

## Safety

All imported data stays fake, deterministic, and safe for public review. No
network calls, secrets, or real addresses are ever accepted.
