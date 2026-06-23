# Visual Style Notes

## Layout

- The ready state uses a constrained `max-w-5xl` tool surface matching adjacent
  isolated tool workspaces.
- Summary metrics use a compact responsive definition list.
- Ownership cards use a single card layer with actions aligned to the side on
  wider screens and wrapping on narrow screens.

## Color System

- `unassigned` uses blue for unclaimed work.
- `owned` uses emerald for active ownership.
- `stale` uses amber for handoffs that need attention.
- `resolved` uses slate for completed work.

## Typography

- Tool title uses `text-2xl`.
- Card titles use `text-base` so long subjects wrap cleanly.
- Supporting metadata uses `text-sm` and `leading-6` for scan-friendly review.

## Interaction Treatment

- Claim uses a dark filled button.
- Transfer, release, retry, and add-sample actions use bordered or secondary
  button styles.
- All controls use the same focus-visible outline treatment as sibling tool
  components.
