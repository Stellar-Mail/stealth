# Accessibility Notes

## State Announcements

- The loading state uses `role="status"`, `aria-live="polite"`, and `aria-busy="true"` so assistive technologies announce progress.
- The error state uses `role="alert"` for immediate notification.
- The empty state uses `role="status"` with a descriptive accessible label.
- The success view is labelled using `aria-labelledby="confidential-mode-title"`.

## Keyboard Support

- Interactive controls use native HTML elements.
- Buttons are keyboard accessible using Tab and Enter/Space.
- Focus indicators use `focus-visible` outlines.
- No custom keyboard handling overrides browser defaults.

## Screen Reader Support

- Decorative icons use `aria-hidden="true"`.
- Recommendation lists use `role="list"` and `role="listitem"`.
- Recommendation severity is presented as visible text rather than color alone.
- Section headings provide meaningful navigation landmarks.

## Color and Contrast

- High severity recommendations use red with accompanying text.
- Medium severity recommendations use amber with accompanying text.
- Low severity recommendations use emerald with accompanying text.
- Color is never the only method used to communicate importance.

## Responsive Behaviour

- Cards stack vertically on smaller screens.
- Text wraps instead of overflowing.
- Summary tiles collapse into a single column on narrow displays.

## Manual Accessibility Checklist

- Navigate the interface using only the keyboard.
- Verify focus indicators are visible.
- Confirm loading and error announcements are read by screen readers.
- Ensure recommendation cards are announced correctly.
- Verify layout remains readable on mobile-width screens.
