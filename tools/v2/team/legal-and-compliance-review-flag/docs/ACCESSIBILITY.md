# Legal and Compliance Review Flag Accessibility

## Screen Reader Support

- The root UI uses a named `main` landmark through `aria-labelledby`.
- Loading and empty states use `role="status"` with `aria-live="polite"`.
- Error state uses `role="alert"` with `aria-live="assertive"`.
- Review list entries expose descriptive `aria-label` values and selected state
  with `aria-pressed`.
- The action cluster uses `role="group"` with a label tied to the selected
  review flag.
- Decorative icons are marked with `aria-hidden="true"`.

## Keyboard Support

- Review rows are implemented as native buttons, so Enter and Space activation
  work without custom key handlers.
- Approve, escalate, dismiss, and retry actions are native buttons.
- Focus rings use `focus-visible` styles with visible two-pixel rings and
  offsets.
- Tab order follows the visible workflow: heading, queue items, detail actions.

## States

The component exposes four reviewable states:

- `loading`: polite live region with progress icon.
- `error`: assertive live region and optional retry action.
- `empty`: polite live region for zero review flags.
- `success`: queue plus selected detail panel and action group.

## Isolation

This UI is not mounted into the main app. Future integration should pass
sanitized review items through props and keep routing, auth, database,
mail-rendering, wallet, and Stellar behavior outside this folder.
