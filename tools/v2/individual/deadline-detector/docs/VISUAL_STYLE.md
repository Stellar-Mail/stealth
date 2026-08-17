# Visual Style

## Layout

The tool uses one constrained workspace panel with a compact header, summary
metrics, filter controls, and a vertical result list. This keeps the isolated
tool readable without implying it is already part of the production app shell.

## Color

- Slate is the neutral base for text, borders, and primary actions.
- Red marks missed deadlines.
- Amber marks deadlines due today or requiring caution.
- Blue marks soon deadlines.
- Emerald marks later low-pressure deadlines.

Color is paired with visible text labels so status never depends on hue alone.

## Components

- Cards use `8px` rounded corners and light borders.
- Buttons use native `<button>` elements with icon and text labels.
- Summary metrics are compact `<dl>` tiles.
- Filters use segmented radio labels backed by native inputs.

## Motion

The loading skeleton uses subtle pulse animation only. No critical information
depends on animation.

## Responsive Behavior

- Summary metrics collapse from four columns to two columns on narrow screens.
- Result cards stack actions beneath content on small screens.
- Long subjects and evidence text wrap instead of overflowing.
