# Email Translator — Accessibility Documentation

## Overview

The Email Translator UI has been built with accessibility as a core requirement, following WCAG 2.1 Level AA guidelines. All interactive components include proper ARIA attributes, keyboard navigation, focus management, and screen reader support.

---

## State Announcements

### Loading State

- Uses `role="status"` for non-intrusive announcements
- Includes `aria-live="polite"` so screen readers announce status changes
- Sets `aria-busy="true"` to indicate ongoing process
- Visual loading spinner marked with `aria-hidden="true"`

**Component:** `EmailTranslatorLoadingState`

### Error State

- Uses `role="alert"` for immediate failure announcement
- Screen readers interrupt to announce errors
- Retry button has clear label and focus indication
- Error details provided in plain text

**Component:** `EmailTranslatorErrorState`

### Empty State

- Uses `role="status"` with scoped `aria-label`
- Announces "No translation results" to screen readers
- Decorative icons marked with `aria-hidden="true"`

**Component:** `EmailTranslatorEmptyState`

### Success State

- Main section labeled by `email-translator-title` heading
- Translation output uses `role="textbox"` for content accessibility
- Copy button announces "Copied to clipboard" state change

---

## Keyboard Navigation

### Language Selector

- **Tab:** Focus the selector button
- **Enter/Space:** Open language list
- **Arrow Down/Up:** Navigate through language options
- **Home/End:** Jump to first/last option
- **Escape:** Close list and return focus to button
- **Enter/Space (in list):** Select language and close list

The language selector implements full ARIA 1.2 combobox/listbox patterns with:

- `aria-expanded` state on button
- `aria-haspopup="listbox"` attribute
- `role="listbox"` on dropdown
- `role="option"` on each language
- `aria-selected` for current selection

**Component:** `LanguageSelector`

### Text Input

- Native `<textarea>` with proper label association
- Supports standard text editing shortcuts
- **Ctrl+Enter (Cmd+Enter on Mac):** Trigger translation
- Focus visible outline on keyboard focus
- Associated description via `aria-describedby`

**Component:** `TranslationInput`

### Buttons

- All buttons are native `<button>` elements
- Clear focus indicators using `focus-visible` outlines
- Disabled state properly communicated
- Action buttons include visible labels

### Copy Button

- Keyboard accessible
- Announces state change ("Copied to clipboard")
- Visual feedback via icon change (Copy → Check)
- 2-second timeout before reverting to default state

**Component:** `TranslationOutput`

---

## Screen Reader Support

### Semantic HTML

- Proper heading hierarchy (`<h1>`, `<h2>`)
- Native form controls (`<button>`, `<textarea>`, `<input>`)
- Landmark regions via semantic elements (`<section>`, `<header>`)

### Labels and Descriptions

- All form inputs have associated `<label>` elements
- Complex inputs use `aria-describedby` for additional context
- Language selector has visible label text
- Translation areas have both labels and descriptions

### Decorative Content

- Icons marked with `aria-hidden="true"` when decorative
- Visual-only indicators paired with text labels
- Color never used as the only indicator of state

### Dynamic Content

- State changes announced via `aria-live` regions
- Loading states use `role="status"` with `aria-busy`
- Errors use `role="alert"` for immediate attention
- Copy success announced to screen readers

---

## Color and Contrast

### Text Contrast

- Body text: slate-900 on white (>7:1 contrast ratio)
- Secondary text: slate-600 on white (>4.5:1 contrast ratio)
- Button text: white on slate-950 (>12:1 contrast ratio)

### State Indicators

- Error states: Red border (red-200) + red background (red-50) + red text (red-700)
- Success states: Check icon + text label
- Focus states: 2px outline with 2px offset
- Disabled states: Reduced opacity (0.5) + cursor change

### Focus Indicators

- All interactive elements have visible focus outlines
- Uses `focus-visible` for keyboard-only focus styling
- Outline color: slate-950 with 2px width
- Outline offset: 2px for clear separation

---

## Responsive Design

### Mobile Considerations

- Touch targets minimum 44×44 pixels
- Language selectors stack vertically on small screens
- Text inputs scale to container width
- Buttons maintain readable size at all breakpoints

### Zoom Support

- Interface remains functional at 200% zoom
- No horizontal scrolling at standard breakpoints
- Text reflows properly without overlapping

---

## Testing Checklist

### Keyboard Navigation

- [ ] Tab through all interactive elements in logical order
- [ ] Open language selector with Enter/Space
- [ ] Navigate language list with arrow keys
- [ ] Select language with Enter
- [ ] Close selector with Escape
- [ ] Focus returns to button after selection
- [ ] Translate button triggered with click or Enter
- [ ] Ctrl+Enter keyboard shortcut works from textarea
- [ ] Copy button accessible via keyboard

### Screen Reader Testing

- [ ] All headings announced in correct hierarchy
- [ ] Form labels read before input fields
- [ ] Language selector state changes announced
- [ ] Loading state announced ("Translating email...")
- [ ] Error state announced immediately
- [ ] Translation output content readable
- [ ] Copy success announced
- [ ] Button purposes clear from labels

### Visual Testing

- [ ] Focus outlines visible on all interactive elements
- [ ] Text remains readable at 200% zoom
- [ ] Interface functional at 320px viewport width
- [ ] Color contrast meets WCAG AA standards
- [ ] Disabled states visually distinct
- [ ] Error states visible without color alone

### Assistive Technology

- [ ] Test with NVDA (Windows)
- [ ] Test with JAWS (Windows)
- [ ] Test with VoiceOver (macOS/iOS)
- [ ] Test with TalkBack (Android)
- [ ] Test with keyboard only (no mouse)
- [ ] Test with high contrast mode
- [ ] Test with reduced motion enabled

---

## Known Limitations

### Auto-Detection

- Language detection happens automatically when enabled
- Screen readers are notified via visible badge updates
- Detection confidence displayed visually but also in text

### Real-Time Validation

- Form validation messages are not currently implemented
- Future enhancement: add inline error messages for empty inputs

---

## Best Practices Applied

1. **Progressive Enhancement:** Core functionality works without JavaScript
2. **Semantic HTML:** Native elements used wherever possible
3. **Keyboard First:** All interactions available via keyboard
4. **Clear Focus:** Focus indicators meet WCAG 2.1 requirements
5. **Descriptive Labels:** All controls have accessible names
6. **State Management:** Dynamic states announced to assistive tech
7. **Error Recovery:** Clear error messages with retry options
8. **Color Independence:** State never indicated by color alone

---

## References

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Keyboard Accessibility](https://webaim.org/techniques/keyboard/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
