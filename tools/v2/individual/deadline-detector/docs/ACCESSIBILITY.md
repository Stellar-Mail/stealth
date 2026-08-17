# Accessibility Notes

## State Announcements

- `DeadlineDetectorLoadingState` uses `role="status"`, `aria-live="polite"`,
  and `aria-busy="true"` so screen readers can announce scan progress.
- `DeadlineDetectorErrorState` uses `role="alert"` for immediate failure
  announcement.
- `DeadlineDetectorEmptyState` uses `role="status"` with a scoped
  `aria-label`.
- The success view is labelled by `deadline-detector-title`.

## Keyboard Behavior

- Status filters are native radio inputs wrapped by labels, so arrow-key and tab
  behavior follows browser defaults.
- Review and reminder controls are native buttons.
- Focus indicators use `focus-visible` outlines with sufficient offset.
- The UI does not trap focus or create hidden modal states.

## Screen Reader Names

- Decorative icons use `aria-hidden="true"`.
- Reminder buttons include the deadline title in `aria-label`.
- Review buttons include the deadline title in `aria-label`.
- The result list uses `role="list"` and `role="listitem"` wrappers.

## Color And Contrast

- Status pills combine text labels with color.
- Red, amber, blue, emerald, and slate states use text labels such as `missed`,
  `soon`, and `review required`.
- Primary action buttons use dark text contrast against white or white text
  against slate.

## Manual Checklist

- Tab through the header action, status filters, and result actions.
- Confirm focus outlines are visible at each stop.
- Confirm loading and error states announce with screen-reader tooling.
- Confirm each icon still has a neighboring text label or an accessible button
  name.
- Confirm the UI remains readable at narrow widths.
