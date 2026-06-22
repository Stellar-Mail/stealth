# Contacts Import Handoff

This note maps the current contacts import implementation for contributors who
need to extend or test the migration flow without weakening the safety
boundaries around address trust, retention, and policy writes.

## Current module map

The active implementation lives in `src/features/contacts/import/`.

| File | Role |
| --- | --- |
| `ContactMigrationDialog.tsx` | Owns the import modal state machine, parsed rows, identity matches, retention cleanup, and bulk policy write lifecycle. |
| `ImportSourcePicker.tsx` | Handles CSV upload/paste/manual entry and shows disabled provider sources until OAuth/API imports are implemented. |
| `IdentityReviewTable.tsx` | Lets users inspect exact, fuzzy, ambiguous, and unmatched rows before migration. |
| `BulkWriteProgressPanel.tsx` | Shows write progress, pause/resume controls, completed jobs, and failed jobs. |
| `csvParser.ts` | Parses CSV/TSV content, validates addresses, and deduplicates rows by case-insensitive address. |
| `identityMatcher.ts` | Compares imported rows with known contacts and classifies match confidence. |
| `bulkPolicyWriter.ts` | Creates sender policy write jobs and tracks write progress. |
| `dataRetention.ts` | Saves import sessions with source-specific retention windows and removes expired sessions. |
| `types.ts` | Shared types for import sources, rows, matches, policy jobs, progress, retention, and sessions. |

The older issue text mentions `src/features/contacts/ImportWizard.tsx`,
`parseContacts.ts`, and `types.ts`. Those names are stale; use the import
folder paths above when reviewing or changing the current app.

## Data contracts

| Type | Safety notes |
| --- | --- |
| `ImportSource` | CSV and manual sources are active. Gmail, Outlook, and contacts API sources are displayed as disabled until real provider integrations exist. |
| `ImportedContactRow` | Treat `name`, `address`, `raw`, and `error` as user-supplied data. Do not log real imports or copy them into fixtures. |
| `IdentityMatch` | `matchType: "ambiguous"` is intentionally not auto-approved, even when name similarity is high. |
| `PolicyWriteJob` | Carries the owner, imported row, approval state, and result metadata for each sender policy write. |
| `BulkWriteProgress` | Drives progress UI. Keep failed jobs visible so a user can inspect partial migrations. |
| `DataRetentionPolicy` | Controls how long raw import sessions may remain in local storage. Shorter retention is safer for provider-backed sources. |
| `ImportSession` | Stores raw rows and matches for resume/review flows. Any new storage must keep the same retention and cleanup discipline. |
| `MigrationStep` | Current UI uses source selection, identity review, migration, and done states. Preserve clear handoffs between review and writes. |

## User-facing states to preserve

- Empty import: show a neutral prompt and avoid creating policy jobs.
- CSV upload or paste: parse rows only after user input; keep invalid rows visible
  with actionable errors.
- Disabled providers: keep Gmail, Outlook, and contacts API imports unavailable
  until OAuth consent, retention, and revocation behavior are implemented.
- Manual entry: validate the same way as CSV rows.
- Duplicate addresses: deduplicate by lowercased address so later rows replace
  earlier rows intentionally.
- Exact and fuzzy matches: show the suggested contact identity before policy
  writes are approved.
- Ambiguous matches: require user review and never silently promote to trusted.
- Unmatched rows: keep them selectable, but do not imply the address is known.
- Running migration: show progress, pause/resume state, completed jobs, and
  failed jobs without hiding partial writes.
- Done state: summarize completed work and keep failures discoverable.

## Safety and privacy boundaries

- Imported contacts are sensitive. Do not add real contact exports, real mailbox
  data, private federation addresses, or customer-like datasets to the repo.
- Keep sample data synthetic and small. Prefer obvious placeholder addresses in
  docs and tests.
- Address validation belongs in `validateImportAddress`; UI code should surface
  parser errors instead of duplicating new validation rules.
- Identity matching is advisory. The user must remain in control of ambiguous
  or low-confidence matches before sender policy writes are created.
- Retention cleanup in `dataRetention.ts` should run before restoring sessions
  from storage. New import sources need explicit retention defaults.
- Sender policy writes must use the active `owner` passed into
  `ContactMigrationDialog`; do not infer owners from imported rows.
- Avoid analytics payloads that include raw contact names, raw addresses, or
  parser error text copied from a user file.

## QA checklist

- Parse empty input, BOM-prefixed CSV, comma-delimited CSV, tab-delimited TSV,
  and semicolon-delimited rows.
- Verify accepted address forms: Stellar `G...`, Stealth `S...`, and federation
  `name*domain` addresses.
- Verify invalid addresses remain visible and do not become policy write jobs.
- Verify duplicate rows use the last matching address entry.
- Exercise exact, fuzzy, ambiguous, and unmatched identity results.
- Confirm ambiguous rows require review before approval.
- Confirm disabled provider buttons remain disabled and do not start migration.
- Confirm session cleanup removes expired imports and preserves unexpired ones.
- Confirm pause/resume and failed bulk writes remain visible in the progress
  panel.
- Confirm closing and reopening the dialog does not expose expired raw imports.

## Suggested validation

When dependencies are installed, run the targeted import tests first:

```bash
npx vitest run tests/unit/import/csvParser.test.ts tests/unit/import/identityMatcher.test.ts tests/unit/import/dataRetention.test.ts tests/unit/import/bulkPolicyWriter.test.ts
```

For UI or state-machine changes, also run the broader unit suite used by this
repo:

```bash
npm test
```

For documentation-only changes, at minimum run `git diff --check` before
opening a PR.
