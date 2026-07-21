# Bulk Move Panel

Lets an admin move multiple selected demo messages between mailbox folders at
once, with validation, a move preview, and an audit summary of what changed.

All logic and UI live inside `src/features/demo-admin-dashboard/` and operate on
fake, deterministic demo data (`EditableMessage[]`). Nothing here touches real
mail flows, network calls, or data outside this folder.

## Pieces

- `bulkMovePanel.ts` — pure, immutable helpers:
  - `isValidMessageFolder` — checks a folder id against the message-list
    taxonomy (`MessageFolder`).
  - `validateBulkFolderMove` — rejects empty selections, unknown message ids, and
    invalid destination folders before a move runs.
  - `previewBulkFolderMove` — counts how many selected messages would move vs
    skip without mutating input.
  - `applyBulkFolderMove(messages, selectedIds, targetFolder)` — returns a new
    message list plus a per-message change log and an audit summary. Inputs are
    never mutated.
  - `summarizeBulkFolderMove(result)` — a one-line human summary.
- `components/BulkMovePanel.tsx` — selected-message list, destination folder
  picker, move preview, and audit output.

## Folder taxonomy

Bulk moves use `MessageFolder` from the message-list editor model (`inbox`,
`sent`, `drafts`, `archive`, `spam`, `trash`). Display labels come from the
shared `FOLDER_DEFINITIONS` map. The `snoozed` folder is intentionally excluded
here because it is not part of the editable message-list model.

## Validation

- **Selection:** at least one message id must be selected.
- **Target folder:** must be a known `MessageFolder`.
- **Message ids:** every selected id must exist in the provided message list.

Validation errors are surfaced in the panel before any move is applied.

## Skip rules

A selected message already filed under the destination folder is skipped (never
duplicated or re-written). Skipped messages are reported per item and counted in
the audit summary.

## Audit summary

`applyBulkFolderMove` returns a `summary` with the target folder, number of
selected messages, and counts for moved vs skipped items. Example line:
`Moved 2 messages to Drafts (1 skipped — already in Drafts).`

## Follow-up

Wiring this component into the main dashboard view is intentionally left as a
follow-up so this change stays scoped and independently reviewable.
