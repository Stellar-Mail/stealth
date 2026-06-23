# Accessibility Notes

## State Announcements

- `ConfidentialModeLoadingState` uses `role="status"`, `aria-live="polite"`,
  and `aria-busy="true"` so assistive technology can announce review progress.
- `ConfidentialModeErrorState` uses `role="alert"` for immediate failure
  announcement.
- `ConfidentialModeEmptyState` uses `role="status"` with a scoped
  `aria-label`.
- The ready view is labelled by `confidential-mode-title`.

## Keyboard Behavior

- Status filters are native radio inputs wrapped by labels, so tab and arrow-key
  behavior follows browser defaults.
- Apply, dismiss, retry, and add-draft actions are native buttons.
- Focus indicators use `focus-visible` outlines with sufficient offset.
- The UI does not trap focus or create hidden modal states.

## Screen Reader Names

- Decorative icons use `aria-hidden="true"`.
- Apply buttons include the draft title in `aria-label`.
- Dismiss buttons include the draft title in `aria-label`.
- The result list uses `role="list"` and `role="listitem"` wrappers.
- Each suggestion card labels its privacy-signal list with the draft title.

## Manual Checklist

- Tab through add-draft, filter, apply, dismiss, and retry controls.
- Confirm focus outlines remain visible at each stop.
- Confirm loading and error states announce with screen-reader tooling.
- Confirm icon-backed buttons have readable accessible names.
- Confirm filtered empty results announce as a status region.
