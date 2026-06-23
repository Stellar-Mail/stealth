# Accessibility Notes

## State Announcements

- `OwnershipLoadingState` uses `role="status"`, `aria-live="polite"`, and
  `aria-busy="true"` so assistive technology can announce loading progress.
- `OwnershipErrorState` uses `role="alert"` for immediate failure announcement.
- `OwnershipEmptyState` uses `role="status"` with a scoped `aria-label`.
- The ready view is labelled by `email-ownership-title`.

## Keyboard Behavior

- Ownership filters are native radio inputs wrapped by labels.
- Claim, transfer, release, retry, and add-sample actions are native buttons.
- Focus indicators use `focus-visible` outlines with sufficient offset.
- The UI does not trap focus or create hidden modal states.

## Screen Reader Names

- Decorative icons use `aria-hidden="true"`.
- Claim, transfer, and release buttons include the message subject in
  `aria-label`.
- The result list uses `role="list"` and `role="listitem"` wrappers.
- Status chips use visible text labels; color is never the only signal.

## Manual Checklist

- Tab through add-sample, filter, claim, transfer, release, and retry controls.
- Confirm focus outlines remain visible at each stop.
- Confirm loading and error states announce with screen-reader tooling.
- Confirm icon-backed controls have neighboring text or accessible names.
