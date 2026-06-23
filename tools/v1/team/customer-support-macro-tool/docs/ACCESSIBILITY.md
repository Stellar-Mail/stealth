# Accessibility Notes

## State Announcements

- `MacroToolLoadingState` uses `role="status"`, `aria-live="polite"`, and
  `aria-busy="true"` so assistive technology can announce loading progress.
- `MacroToolErrorState` uses `role="alert"` for immediate failure announcement.
- `MacroToolEmptyState` uses `role="status"` with a scoped `aria-label`.
- The ready view is labelled by `support-macro-tool-title`.

## Keyboard Behavior

- Search uses a native `input type="search"` with a visible label.
- Category filters are native radio inputs wrapped by labels.
- Apply, favorite, edit, retry, and create actions are native buttons.
- Focus indicators use `focus-visible` outlines with sufficient offset.

## Screen Reader Names

- Decorative icons use `aria-hidden="true"`.
- Apply, favorite, and edit buttons include the macro title in `aria-label`.
- The macro list uses `role="list"` and `role="listitem"` wrappers.
- Category and favorite chips use visible text labels; color is never the only
  signal.

## Manual Checklist

- Tab through search, category filters, create, apply, favorite, edit, and retry
  controls.
- Confirm focus outlines remain visible at each stop.
- Confirm loading and error states announce with screen-reader tooling.
- Confirm macro actions have readable accessible names.
