# Contacts Import Contributor Handoff

This module renders the existing Stealth Mail contacts import wizard: pulling in a CSV/TSV file, a provider export, or a manual paste, resolving each row against known identities, and writing the result into the user's contact/policy list. It is a local app surface, not a new tool folder, and changes here should preserve the current safety promise: parsing is entirely client-side, malformed rows are surfaced (not silently dropped), and nothing is written to storage until the user explicitly confirms the import.

## Local Files

- `import/ImportSourcePicker.tsx` — the wizard's entry step; lets the user choose a source (`csv`, `provider-gmail`, `provider-outlook`, `contacts-api`, `manual`) and supplies the raw text/file for parsing.
- `import/csvParser.ts` — `parseImportCsv` turns raw CSV/TSV text into `ImportedContactRow[]`. Auto-detects the delimiter (`,`/`;`/tab), auto-detects a header row against a fixed set of known header layouts, and falls back to positional parsing (1 column = address only, 2 columns = name+address) when no header matches. `validateImportAddress` accepts a Stellar G-address, a Stealth S-address, or a federation address (`name*domain`); anything else produces a row-level `error` string rather than throwing. `deduplicateRows` collapses same-address rows case-insensitively, keeping the last occurrence.
- `import/identityMatcher.ts` — resolves each parsed row against the user's existing contacts/identities. Exact address matches are certain; `editDistance`-based name similarity (Levenshtein, `FUZZY_THRESHOLD = 0.6`) produces lower-confidence fuzzy matches for manual review rather than auto-merging.
- `import/IdentityReviewTable.tsx` — the review step where a user confirms, edits, or discards each row (including its match suggestion and error state) before anything is committed.
- `import/bulkPolicyWriter.ts` — commits the reviewed rows: writes contacts and applies the chosen `BulkTrustDefault` (`allow`/`block`/`default`) to any row the user didn't set individually.
- `import/BulkWriteProgressPanel.tsx` — the commit-in-progress UI (per-row progress, partial-failure reporting).
- `import/dataRetention.ts` — defines how long *import session data* (the parsed-but-not-yet-committed rows, not the final contacts) is retained: `session` (discarded on window close), `1h`/`24h`/`7d`, or `never`. `defaultRetentionForSource` picks a stricter default for pasted/CSV data (`session`) than for provider imports (`24h`), since provider imports are expected to be re-run less casually.
- `import/ContactMigrationDialog.tsx` — the top-level dialog that sequences the above steps (pick source → parse → review/match → choose retention & bulk trust default → write).
- `import/types.ts` / `types.ts` — the shared data contracts (`ImportedContactRow`, `ImportSource`, `IdentityMatch`, `DataRetentionPolicy`, `BulkTrustDefault`, etc.).
- `import/index.ts` / `index.ts` — public exports for the rest of the app.

Keep future edits inside this folder unless a small shared UI helper is already needed by multiple existing surfaces.

## Data Contract

An `ImportedContactRow` carries only what the wizard needs to review and commit a contact — never a full mailbox record:

- `id`: stable local id for React rendering (`import-{source}-{index}-{timestamp}`), not a server-assigned identity.
- `name` / `address`: as parsed from the source; `address` is validated but not yet resolved to a real identity.
- `source`: which `ImportSource` the row came from — drives the default retention policy.
- `trust`: `"allow" | "block" | "default"` — the per-row decision, overridable by the bulk `BulkTrustDefault` for any row left at `"default"`.
- `match`: the `IdentityMatch` result (exact / fuzzy / none) surfaced to the user for confirmation; the wizard never silently auto-merges a fuzzy match.
- `error`: a human-readable validation message, or `null`. A row with a non-null `error` can still be displayed and edited — it is not dropped from the list.

**Safety notes:**
- All parsing (`csvParser.ts`) happens in-memory in the browser; the raw file/paste is never sent to a backend before the user reaches the review step.
- Malformed rows are never silently discarded — they carry an `error` and remain visible in `IdentityReviewTable.tsx` for the user to fix or remove. The only rows dropped outright are fully empty lines (no name and no address).
- Fuzzy identity matches are a *suggestion*, never an automatic merge — the user must confirm each match in the review step.
- Retention policy (`dataRetention.ts`) governs the *import session's staging data*, not the final committed contacts — once `bulkPolicyWriter.ts` commits a row, it's a normal contact/policy entry subject to the app's normal contact storage rules, not the import retention window.
- This module must never be exercised in development or demos with real user contact lists, live customer mail, secrets, or private keys — use synthetic/demo data only.

## User-Facing States

- **Source selection**: `ImportSourcePicker.tsx` presents the available sources; provider-based sources imply a stricter default retention window than manual/CSV.
- **Parsed, unreviewed**: rows exist with `match`/`error` populated but `trust` still at `"default"` — nothing has been written yet.
- **Malformed row**: a row with a non-null `error` renders in `IdentityReviewTable.tsx` with its error message visible; the user can edit the address inline or remove the row, but it does not block review/commit of the other rows.
- **Match review**: rows with an `IdentityMatch` show the suggested existing contact for the user to confirm, override, or ignore.
- **Committing**: `BulkWriteProgressPanel.tsx` shows per-row commit progress and surfaces partial failures (a row that fails to write doesn't silently vanish from the report).
- **Empty**: no parsed rows (empty paste/file, or a file that produced zero non-empty lines) — the wizard should make it clear nothing was found rather than silently closing.

## Lightweight QA Checklist

- [ ] Paste a header-less two-column CSV (`name,address`) and confirm rows parse with the correct name/address split.
- [ ] Paste a headerless single-column list of addresses only — confirm each becomes a row with an empty `name`.
- [ ] Include one row with an invalid address (not G-address, S-address, or `name*domain`) — confirm it surfaces a row-level `error` and is still visible/editable in the review table, not dropped.
- [ ] Include two rows with the same address in different casing — confirm `deduplicateRows` keeps only the later occurrence.
- [ ] Include a row whose name closely (but not exactly) matches an existing contact — confirm it surfaces as a fuzzy match for manual confirmation, not an automatic merge.
- [ ] Switch the source to a provider option and confirm the default retention policy shown is `24h` rather than the CSV default of `session`.
- [ ] Commit a batch containing at least one row that will fail to write (if a way to force this exists in local/dev data) and confirm `BulkWriteProgressPanel.tsx` reports the partial failure rather than reporting a false "all succeeded."

There is currently no automated test coverage for this feature (`import/` has no `*.test.*` files as of this handoff) — the checklist above is manual until unit/e2e tests exist for `csvParser.ts` and `identityMatcher.ts` in particular, since those two are the most logic-dense, least-UI-dependent pieces and the easiest to cover first.
