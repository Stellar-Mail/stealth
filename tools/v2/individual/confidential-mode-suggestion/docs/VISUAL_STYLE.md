# Visual Style Notes

## Layout

- The ready state uses a constrained `max-w-5xl` tool surface matching other V2
  individual tool workspaces.
- Summary metrics use a compact responsive definition list.
- Suggestion cards use a single-level card structure with actions aligned beside
  the reviewed draft content on wider screens.

## Color System

- `suggested` uses blue for recommended confidential-mode action.
- `blocked` uses red for high-risk drafts requiring manual review.
- `safe` uses emerald for drafts that do not need extra protection.
- Status chips always include text labels; color is never the only signal.

## Typography

- Tool title uses a compact `text-2xl` heading.
- Card titles use `text-base` so long draft names wrap without dominating the
  workflow.
- Supporting copy uses `text-sm` and `leading-6` for scan-friendly review.

## Interaction Treatment

- Primary apply action uses a dark filled button.
- Secondary dismiss and add-draft actions use bordered buttons.
- All controls keep the same focus-visible outline treatment as adjacent V2 tool
  components.
