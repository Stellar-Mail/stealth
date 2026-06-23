# Visual Style Notes

## Layout

- The ready state uses a constrained `max-w-5xl` tool surface matching adjacent
  V2 individual tool workspaces.
- Source and target language controls sit in one responsive row on desktop and
  stack on narrow screens.
- Translation result cards use a two-column source/translation comparison when
  space allows.

## Color System

- `translated` uses emerald for successful output.
- `needs-review` uses amber for translations requiring human review.
- `blocked` uses red for unsafe translation attempts.
- Status chips always include text labels; color is never the only signal.

## Typography

- Tool title uses a compact `text-2xl` heading.
- Card titles use `text-base` so long subjects wrap cleanly.
- Email body previews use `whitespace-pre-wrap`, `text-sm`, and `leading-6` to
  preserve readable message structure.

## Interaction Treatment

- The translate and review actions use dark filled buttons.
- Copy and add-text actions use bordered buttons.
- All controls keep the same focus-visible outline treatment as adjacent V2 tool
  components.
