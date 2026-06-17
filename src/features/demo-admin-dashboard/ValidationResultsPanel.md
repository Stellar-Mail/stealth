# ValidationResultsPanel

Displays dataset validation errors and warnings with their field paths for the
demo admin dashboard. All data is fake and deterministic; nothing here touches
production mail flows.

## Pieces

- `validation-types.ts` — `ValidationIssue`, `ValidationSeverity`,
  `ValidationNavigation`, and summary/group types.
- `validation.ts` — helpers: `summarizeValidation`, `sortIssues`,
  `groupBySeverity`, `getIssueNavigation`, `isDatasetValid`.
- `validationFixtures.ts` — `demoValidationIssues` (and an empty variant).
- `ValidationResultsPanel.tsx` — the panel UI.

## Behavior

- Issues are grouped by severity (errors, then warnings, then info); empty
  groups are hidden.
- A summary row shows counts per severity.
- Each issue shows its message, field path, and an optional fix hint.
- When `onSelectIssue` is provided, issues become clickable and report
  `ValidationNavigation` metadata (datasetId, recordId, fieldPath) so a parent
  can navigate to the source field.
- With no issues, a friendly empty state is shown.
