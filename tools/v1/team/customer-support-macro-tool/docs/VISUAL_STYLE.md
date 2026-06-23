# Visual Style Notes

## Layout

- The ready state uses a constrained `max-w-5xl` tool surface.
- Search and category filters are grouped in one control band.
- Macro cards use one card layer with action buttons wrapping on narrow screens.

## Color System

- Macro categories use distinct chip colors for quick scanning.
- Favorite state uses amber with a text label.
- Primary apply/create actions use dark filled buttons.
- Edit and favorite actions use bordered secondary buttons.

## Typography

- Tool title uses `text-2xl`.
- Macro titles use `text-base` so long templates wrap cleanly.
- Macro bodies use `text-sm`, `leading-6`, and `whitespace-pre-wrap` to preserve
  readable response structure.

## Interaction Treatment

- Search preserves stable height while filtering.
- Category filter labels use the same selected/unselected treatment as adjacent
  isolated tool workspaces.
- All controls use the same focus-visible outline treatment.
