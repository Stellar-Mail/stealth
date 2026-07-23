# Accessibility Notes

## State Announcements

- `DraftImproverLoadingState` uses `role="status"`, `aria-live="polite"`,
  and `aria-busy="true"` so screen readers can announce analysis progress.
- `DraftImproverErrorState` uses `role="alert"` for immediate failure
  announcement.
- `DraftImproverEmptyState` uses `role="status"` with a scoped `aria-label`.
- The success view is labelled by `draft-improver-title`.

## Keyboard Behaviour

- Category and severity filters are native radio inputs wrapped by labels, so
  arrow-key and tab behaviour follows browser defaults.
- Retry and action controls are native buttons.
- Focus indicators use `focus-visible` outlines with sufficient offset.
- The UI does not trap focus or create hidden modal states.

## Screen Reader Names

- Decorative icons use `aria-hidden="true"`.
- The result list uses `role="list"` and `role="listitem"` wrappers.
- Severity badges are rendered as `<span>` elements with visible text labels.
- Suggestion text is presented as plain text with `aria-hidden` icons.

## Color And Contrast

- Severity badges combine text labels with color (red for error, amber for
  warning, blue for info).
- Score bar colours use emerald (good), amber (moderate), and red (poor) paired
  with numeric labels.
- Primary action buttons use dark text contrast against white or white text
  against slate.
- Color is never the only status signal.

## Manual Checklist

- Tab through the header, status filters, and issue cards.
- Confirm focus outlines are visible at each stop.
- Confirm loading and error states announce with screenreader tooling.
- Confirm filter radios announce their checked state and group label.
- Confirm the UI remains readable at narrow widths.
