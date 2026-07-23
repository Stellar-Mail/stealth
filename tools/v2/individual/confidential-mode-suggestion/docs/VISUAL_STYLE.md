# Visual Style

## Layout

The tool presents a compact workspace consisting of:

- Header
- Privacy summary
- Recommendation list
- Empty, loading, and error states

The UI is intentionally isolated and does not depend on the shared application shell.

## Color

- Slate is used for neutral UI elements.
- Red indicates high-priority privacy recommendations.
- Amber indicates medium-priority recommendations.
- Emerald indicates positive or low-priority recommendations.

Every color cue is accompanied by visible text.

## Components

- Recommendation cards use rounded corners and light borders.
- Summary metrics are displayed as compact information tiles.
- Buttons use native HTML controls.
- Icons are decorative and marked as `aria-hidden`.

## Motion

Loading placeholders use subtle pulse animation only.

No important information depends on animation.

## Responsive Behaviour

- Summary cards stack vertically on narrow screens.
- Recommendation cards wrap naturally.
- Long text wraps instead of overflowing.
- Layout remains usable on desktop and mobile screens.
