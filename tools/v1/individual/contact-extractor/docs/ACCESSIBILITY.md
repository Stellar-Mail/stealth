# Contact Extractor - Accessibility Guidelines

## Overview

The Contact Extractor tool is built with accessibility as a first-class concern. All components are designed to meet WCAG 2.1 Level AA standards.

## WCAG 2.1 Level AA Compliance

### Color Contrast

- All text meets minimum 4.5:1 contrast ratio for normal text
- All interactive elements clearly distinguish focus state
- Color is not the only means of conveying information (source badges use both color and text)

### Keyboard Navigation

- All interactive elements are keyboard accessible
- Tab order is logical and intuitive
- Focus indicators are visible (focus-visible ring style)
- Ctrl+Enter keyboard shortcut for extraction
- No keyboard traps exist
- Escape to dismiss when applicable

### Screen Readers

- All components use semantic HTML (`<form>`, `<button>`, `<label>`, `<h1>`, `<h2>`)
- Icon-only elements have `aria-label` or `aria-hidden="true"` as appropriate
- State changes announce via `aria-live` (polite for loading, assertive for success)
- List structure uses proper `role="list"` and `role="listitem"`
- Loading state uses `aria-busy="true"` for screen reader users
- Error state uses `role="alert"` for immediate announcement
- Contact cards include proper heading hierarchy with `<h2>` for section and `<h3>` for individual contacts

### Focus Management

- Focus starts on the textarea on mount
- Focus indicators are always visible
- Form submission maintains focus context
- Loading state preserves input focus for resume

## Component-Specific Guidelines

### ContactInputPanel

- Label associated via `htmlFor` on textarea
- `aria-describedby` links to help text
- `aria-required="true"` on textarea
- Clear button has descriptive `aria-label`
- Submit button has descriptive `aria-label`
- Loading state disables inputs and shows spinner
- Keyboard shortcut (Ctrl+Enter) documented in help text
- Fixture buttons labeled with `aria-label`

### EmptyState

- `role="status"` announces this is informational
- Clear heading hierarchy with `<h2>`
- Action button has descriptive `aria-label`

### LoadingState

- `role="status"` with `aria-live="polite"` and `aria-busy="true"`
- Announce message in `sr-only` element
- Spinner has `aria-hidden="true"`

### ErrorState

- `role="alert"` for immediate announcement
- Error message is descriptive and actionable
- Retry button and Start Over button clearly labeled

### SuccessState

- `role="status"` with `aria-live="assertive"` for immediate announcement
- `aria-label` includes contact count
- New Extraction button clearly labeled

### ExtractedContactList

- `role="list"` and `role="listitem"` on contact cards
- Each contact has source badge with text (not just color)
- Contact fields include `sr-only` labels before values
- Icons have `aria-hidden="true"` since text provides context
- Heading includes contact count for screen readers

## Testing Accessibility

### Manual Testing Checklist

- [ ] Keyboard navigation works (Tab through all controls)
- [ ] Focus indicators are visible
- [ ] Screen reader announces all content meaningfully
- [ ] Color contrast is sufficient
- [ ] All buttons have descriptive labels
- [ ] No information conveyed by color alone
- [ ] Ctrl+Enter shortcut works in textarea
- [ ] Form submission works with Enter key

### Tools to Test With

- NVDA (Windows) - free screen reader
- JAWS (Windows) - commercial screen reader
- VoiceOver (macOS/iOS) - built-in
- axe DevTools browser extension
- Lighthouse accessibility audit

### Screen Reader Testing Path

1. Load component
2. Review page structure announcement
3. Navigate by heading (h) key in most readers
4. Tab through all interactive elements (input, clear, submit, fixture buttons)
5. Type or paste email text
6. Submit and hear loading announcement
7. Hear result announcement (success with count or error message)
8. Navigate contact list items
9. Start new extraction

## Known Limitations

- No `prefers-reduced-motion` query currently implemented for animations
- No high-contrast mode specific overrides
- Text size scaling inherits from browser defaults

## References

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [Inclusive Components](https://inclusive-components.design/)
