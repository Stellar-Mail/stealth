# Accessibility Notes

## State Announcements

- `EmailTranslatorLoadingState` uses `role="status"`, `aria-live="polite"`,
  and `aria-busy="true"` so assistive technology can announce translation
  progress.
- `EmailTranslatorErrorState` uses `role="alert"` for immediate failure
  announcement.
- `EmailTranslatorEmptyState` uses `role="status"` with a scoped
  `aria-label`.
- The ready view is labelled by `email-translator-title`.

## Keyboard Behavior

- Source and target languages are native `select` elements with visible labels.
- Result filters are native radio inputs wrapped by labels.
- Translate, review, retry, add-text, and copy actions are native buttons.
- Focus indicators use `focus-visible` outlines with sufficient offset.
- The UI does not trap focus or create hidden modal states.

## Screen Reader Names

- Decorative icons use `aria-hidden="true"`.
- The translate button includes source and target language codes in its
  `aria-label`.
- Review buttons include the email subject in `aria-label`.
- Copy status updates use `aria-live="polite"`.
- The result list uses `role="list"` and `role="listitem"` wrappers.

## Manual Checklist

- Tab through language selects, filters, translate, copy, review, retry, and
  add-text controls.
- Confirm focus outlines remain visible at each stop.
- Confirm loading and error states announce with screen-reader tooling.
- Confirm each icon-backed control has a text label or accessible name.
- Confirm filtered empty results announce as a status region.
