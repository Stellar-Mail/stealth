# Accessibility Notes

## State Announcements

- `EmailTemplateLibraryLoadingState` uses `role="status"`, `aria-live="polite"`,
  and `aria-busy="true"` so screen readers can announce loading progress.
- `EmailTemplateLibraryErrorState` uses `role="alert"` for immediate failure
  announcement.
- `EmailTemplateLibraryEmptyState` uses `role="status"` with a scoped `aria-label`.
- The success view is labelled by `email-template-library-title`.
- `TemplateRenderForm` uses `aria-live="polite"` on the rendered output section
  so screen readers announce when the template has been successfully rendered.

## Keyboard Behaviour

- Template cards are interactive and use native `role="button"` semantics with
  `tabIndex={0}` when selectable, supporting both Enter and Space key activation.
- Category filter radios are native radio inputs wrapped by labels, so arrow-key
  and tab behaviour follows browser defaults.
- Form inputs in `TemplateRenderForm` support standard tab navigation and can be
  submitted via Enter key when the form is valid.
- All interactive buttons are native `<button>` elements with proper focus handling.
- Focus indicators use `focus-visible` outlines with sufficient offset (2px) and
  color contrast (slate-950).
- The UI does not trap focus or create hidden modal states.

## Screen Reader Names

- Decorative icons consistently use `aria-hidden="true"`.
- The template list uses `role="list"` and `role="listitem"` wrappers for proper
  semantic structure.
- Each template card is labelled by its name via `aria-labelledby`.
- Form inputs have explicit `<label>` elements with `htmlFor` attributes linking
  to input IDs.
- Required form fields use `aria-required="true"` in addition to the HTML5
  `required` attribute.
- Category badges are rendered as visible text elements paired with decorative icons.
- Variable chips in template cards use semantic markup (`<span>`) with visible
  text labels.

## Color And Contrast

- Category badges use blue background (blue-50) with dark text (blue-700) for
  sufficient contrast.
- Selected states combine border color (slate-950) with background changes
  (slate-50) so selection never depends on color alone.
- Error states use red backgrounds (red-50/red-200) paired with semantic icons
  (AlertTriangle) and dark text (red-700/red-900).
- Form inputs have clear border contrast (slate-300 default, slate-950 focus).
- Disabled states reduce opacity (50%) and change cursor, providing multiple
  visual cues.
- Variable keys use monospace font (font-mono) and neutral backgrounds (slate-100)
  to visually distinguish them from labels.
- Color is never the only status signal.

## Form Validation

- All template variable fields are marked as required both via HTML5 `required`
  attribute and `aria-required="true"`.
- The render button is disabled until all fields are filled, providing clear
  visual feedback.
- Placeholder text provides context for each input field.
- Field labels combine the human-readable label with the technical variable key
  for clarity.

## Responsive Behavior

- Template cards, filters, and forms adapt to narrow viewports without horizontal
  scrolling.
- Multi-column layouts collapse to single column on small screens.
- Text wraps appropriately using `break-words` and `whitespace-pre-wrap` for
  template content.
- Touch targets meet minimum size requirements (buttons use appropriate padding).

## Manual Checklist

- Tab through the header, category filters, template cards, and form inputs.
- Confirm focus outlines are visible at each stop.
- Confirm loading and error states announce with screen reader tooling.
- Confirm category filter radios announce their checked state and group label.
- Confirm template cards are keyboard-activatable with Enter and Space.
- Confirm form submission works via keyboard (Enter key).
- Confirm rendered output is announced when template rendering completes.
- Confirm the UI remains readable at narrow widths (320px minimum).
- Verify that all interactive elements have visible focus indicators.
- Test with screen readers (NVDA, JAWS, VoiceOver) to ensure proper announcements.
