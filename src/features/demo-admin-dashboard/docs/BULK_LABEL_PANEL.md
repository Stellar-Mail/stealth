# Bulk Label Panel

Lets an admin add or remove labels across multiple selected demo messages at
once, with duplicate prevention and an audit summary of what changed.

All logic and UI live inside `src/features/demo-admin-dashboard/` and operate on
fake, deterministic demo data (`DemoMessage[]`). Nothing here touches real mail
flows, network calls, or data outside this folder.

## Pieces

- `bulkLabelPanel.ts` — pure, immutable helpers:
  - `normalizeLabelsForBulk` — normalize, drop blanks, and de-duplicate label
    input for bulk operations.
  - `applyBulkLabelEdit(messages, selectedIds, labels, operation)` — returns a
    new message list plus a per-message change log and an audit summary. Inputs
    are never mutated.
  - `summarizeBulkLabelEdit(result)` — a one-line human summary.
- `components/BulkLabelPanel.tsx` — label state visualization and bulk
  add/remove controls with feedback messages.

## Label distribution

The `calculateLabelState` helper categorizes labels into three groups:

| Category      | Description                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------- |
| **Common**    | Labels present on every selected message. Click to mark for removal.                                          |
| **Partial**   | Labels present on some but not all selected messages. Click to add to all, or click the X to remove from all. |
| **Available** | Labels present on none of the selected messages. Click to select for addition.                                |

## Duplicate prevention

- **Add:** a label already present on a message is skipped (never duplicated).
- **Remove:** a label not present on a message is skipped.

Skipped labels are reported per message and counted in the audit summary.

## Audit summary

`applyBulkLabelEdit` returns a `summary` with the operation, number of selected
and affected messages, and totals for applied vs skipped labels. Example line:
`Added 2 labels across 3 messages (1 skipped as duplicates).`

## Follow-up

Wiring this component into the main dashboard view is intentionally left as a
follow-up so this change stays scoped and independently reviewable.
