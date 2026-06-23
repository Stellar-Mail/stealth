# Email Template Library Accessibility Notes

## Keyboard Operation

- Template actions are native buttons with visible `focus-visible` rings.
- Template cards use `focus-within` styling so keyboard users can keep list context.
- The selected template control exposes `aria-pressed` so assistive technology can identify the
  active preview.
- Empty, retry, create, preview, copy, edit, and dismiss actions all have explicit labels.

## Screen Reader Support

- The page has one `main` landmark labelled by the visible heading.
- The template list uses `role="list"` and `role="listitem"` because cards are not native list
  elements.
- Loading and success states use polite live regions; the error state uses `role="alert"`.
- Preview variable completeness is announced with `role="status"`.
- Missing variables are shown as text, not color alone.

## Integration Notes

If this V2 tool is mounted later, the integration should move focus to the top-level heading when
opening the tool route and preserve the folder-local labels on repeated template actions.
