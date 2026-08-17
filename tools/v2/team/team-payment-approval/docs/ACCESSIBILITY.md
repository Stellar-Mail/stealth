# Team Payment Approval Tool - Accessibility Guide

This document outlines the accessibility features and keyboard navigation patterns implemented in the Team Payment Approval tool.

## Overview

The Team Payment Approval tool is built with accessibility as a core feature, not an afterthought. All interactive elements are fully keyboard navigable and compatible with screen readers.

## Keyboard Navigation

### Global

- **Tab / Shift+Tab**: Navigate between interactive elements
- **Enter**: Activate buttons and links, select radio options
- **Space**: Select radio buttons, checkboxes, toggle buttons
- **Escape**: Close modals, cancel current action, return to list view
- **Ctrl+Enter / Cmd+Enter**: Submit approval form (quick confirm)

### Payment List View

- **Arrow Up/Down**: Move focus between payment request rows
- **Enter/Space**: Select a payment to review
- **Ctrl/Cmd+Click**: Multi-select (if enabled)

### Approval Form

- **Tab**: Move through form fields in logical order
- **Shift+Tab**: Move backward through form fields
- **Arrow Keys**: Navigate radio button options
- **Enter**: Submit form (button must have focus)
- **Escape**: Cancel and return to list

## Screen Reader Support

### Announcements

- **Loading States**: `role="status" aria-live="polite" aria-busy="true"` with descriptive text
- **Errors**: `role="alert" aria-live="assertive"` for immediate announcement
- **Success**: `role="status" aria-live="assertive"` for confirmation
- **State Changes**: When switching between views, context is announced via ARIA live regions

### Labels and Descriptions

- All form inputs have associated `<label>` elements with `htmlFor` attributes
- Interactive controls have `aria-label` or `aria-labelledby` when needed
- Form fields include `aria-describedby` linking to help text
- Required fields marked with `aria-required="true"` and visual indicator

### Navigation Structure

- Semantic HTML: `<form>`, `<fieldset>`, `<legend>` for grouped controls
- Proper heading hierarchy: h1 (tool), h2 (sections), h3 (subsections)
- List structure uses `<table>` with proper `<thead>` and `<tbody>` semantics
- Links and buttons have clear, descriptive text

### Status Indicators

- Status badges include `aria-label` describing the current state
- Priority levels conveyed through both color AND text
- Loading indicators include `aria-hidden="true"` for decorative elements

## Visual Accessibility

### Focus Management

- Clear, visible focus indicators on all interactive elements
- Focus ring uses system color or high-contrast alternative
- Focus order follows logical reading order
- When opening payment details, focus is managed appropriately

### Color Contrast

- All text meets WCAG AA standards (4.5:1 for normal text, 3:1 for large text)
- Information is not conveyed by color alone
- Status indicators combine color with text labels

### Motion

- Animations respect `prefers-reduced-motion` media query
- Loading indicators use minimal animation
- Transitions are smooth but not distracting

## Testing Accessibility

### Screen Reader Testing

Test with:

- **macOS/iOS**: VoiceOver (built-in, ⌘F5)
- **Windows**: NVDA (free, [nvaccess.org](https://www.nvaccess.org/))
- **Windows**: JAWS (commercial)
- **Linux**: Orca (built-in on many distributions)

### Keyboard-Only Testing

- Navigate the entire tool using only keyboard
- Verify all controls are accessible
- Confirm tab order is logical

### Browser Testing

- Test in Chrome with ChromeVox extension
- Test in Firefox with NVDA
- Verify in Edge with Narrator

## Component Accessibility Details

### PaymentApprovalList

```
- Table with proper semantic structure
- Sortable columns with aria-sort attributes
- Row selection with focus management
- Keyboard navigation with arrow keys
- Status badges with accessible labels
```

### PaymentApprovalForm

```
- Fieldset for decision radio group
- Required field indicators
- Error messages linked to fields via aria-describedby
- Keyboard shortcuts documented in sr-only region
- Form validation announces errors via role="alert"
```

### State Components

```
- EmptyState: role="status" with descriptive text
- LoadingState: role="status" aria-busy="true" with polite live region
- ErrorState: role="alert" announces immediately
- SuccessState: role="status" aria-live="assertive" for confirmation
```

## Future Improvements

- [ ] Add touch gesture support for mobile
- [ ] Implement ARIA patterns for complex widgets
- [ ] Add skip links for keyboard users
- [ ] Create high-contrast theme option
- [ ] Add font size adjustment controls
- [ ] Implement voice control support

## WCAG Compliance

This tool targets **WCAG 2.1 Level AA** compliance:

- ✅ Perceivable: Information is presented in multiple ways
- ✅ Operable: Full keyboard navigation, no time limits
- ✅ Understandable: Clear labels, error messages, status indicators
- ✅ Robust: Semantic HTML, ARIA attributes, cross-browser compatible

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM](https://webaim.org/)
- [Radix UI Accessibility](https://www.radix-ui.com/docs/primitives/overview/accessibility)

## Questions or Issues?

If you encounter accessibility issues:

1. Test with your preferred screen reader
2. Check keyboard navigation
3. Verify color contrast and visual clarity
4. File an issue with details about the problem and your setup
