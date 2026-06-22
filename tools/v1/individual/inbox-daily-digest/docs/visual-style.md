# Inbox Daily Digest visual style

The UI is intentionally folder-local and does not depend on the shared design system.

## Surface

- Calm operational layout with one configuration panel and one result region.
- White panels use 8px radii, subtle borders, and restrained shadowing.
- Metrics are displayed as scannable definition-list tiles.

## Color

- Primary action: deep navy `#17324d`.
- Focus ring: amber `#f5b84b`.
- Success badge: green tint `#e7f2ec`.
- Priority states use red, blue, and slate tints so priority is not expressed by one hue alone.

## Accessibility notes

- The component uses a labelled section, labelled form controls, fieldset grouping, and a live preview region.
- The error state uses `role="alert"`.
- Loading communicates progress with `aria-busy`; the spinner is decorative.
- Native buttons, checkboxes, and select controls provide keyboard support.
- Focus-visible styles are defined locally in `styles.css`.
