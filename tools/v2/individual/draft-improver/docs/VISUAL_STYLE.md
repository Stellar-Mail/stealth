# Visual Style

## Layout

The tool uses one constrained workspace panel with a compact header, score
display, issue summary metrics, dual filter controls (category + severity), and
a vertical issue list. This keeps the isolated tool readable without implying it
is already part of the production app shell.

## Color

- Slate is the neutral base for text, borders, and primary actions.
- Red marks errors (high severity issues, missing subjects, sensitive content).
- Amber marks warnings (missing fields, clarity issues, length concerns).
- Blue marks informational items (tone suggestions, style notes).
- Emerald marks good scores.

Colour is paired with visible text labels so status never depends on hue alone.

## Components

- Issue cards use `8px` rounded corners and light borders with a coloured
  severity icon on the left.
- Score bars use a filled-progress pattern with numeric labels.
- Buttons use native `<button>` elements with icon and text labels.
- Summary metrics are compact `<dl>` tiles with coloured backgrounds for errors.
- Filters use segmented radio labels backed by native inputs in two rows
  (category and severity).

## Motion

The loading skeleton uses subtle pulse animation only. No critical information
depends on animation.

## Responsive Behaviour

- Summary metrics collapse from four columns to two columns on narrow screens.
- Score display moves from three columns to two columns on narrow screens.
- Issue cards stack actions beneath content on small screens.
- Long messages wrap instead of overflowing.
- Filter controls stack vertically on narrow screens.
