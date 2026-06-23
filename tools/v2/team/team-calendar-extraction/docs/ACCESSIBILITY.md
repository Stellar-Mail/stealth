# Team Calendar Extraction Tool - Accessibility Guide

This document outlines the accessibility features and keyboard navigation patterns implemented in the Team Calendar Extraction tool.

## Overview

The Team Calendar Extraction tool is built with accessibility as a core feature. All interactive elements are fully keyboard navigable and compatible with screen readers.

## Keyboard Navigation

### Global

- **Tab / Shift+Tab**: Navigate between interactive elements
- **Enter**: Activate buttons, select options
- **Space**: Select radio options, toggle controls
- **Escape**: Cancel current action, return to list view
- **Ctrl+Enter / Cmd+Enter**: Submit extraction form (quick confirm)

### Event List View

- **Arrow Up/Down**: Move focus between event items
- **Enter/Space**: Select an event to view details
- **Tab**: Move to sort controls and action buttons

### Event Detail View

- **Tab**: Move through event details and action buttons
- **Shift+Tab**: Move backward through elements
- **Escape**: Return to event list

### Extraction Form

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

- Semantic HTML: `<form>`, `<fieldset>`, `<legend>`, `<details>`, `<summary>`
- Proper heading hierarchy: h1 (tool), h2 (sections), h3 (subsections)
- List structure uses `<div>` with `role="list"` and `role="listitem"`
- Links and buttons have clear, descriptive text

### Status Indicators

- Status badges include `aria-label` describing the current state
- Priority levels conveyed through both color AND text
- Loading indicators include `aria-hidden="true"` for decorative elements

## Visual Accessibility

### Focus Management

- Clear, visible focus indicators on all interactive elements
- Focus ring uses system color for visibility
- Focus order follows logical reading order
- When opening event details, focus is managed appropriately

### Color Contrast

- All text meets WCAG AA standards (4.5:1 for normal text, 3:1 for large text)
- Information is not conveyed by color alone
- Status and priority combine color with text labels

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

### EventList

```
- Semantic list with role="list" and role="listitem"
- Sort controls with aria-pressed state
- Event selection with focus management
- Keyboard navigation with arrow keys
- Status badges with accessible labels
- Tags and attendees with descriptive text
```

### ExtractionForm

```
- Fieldset for source type radio group
- Required field indicators
- Error messages linked to fields via aria-describedby
- Keyboard shortcuts documented in sr-only region
- Source help text for each extraction method
```

### State Components

```
- EmptyState: role="status" with descriptive text
- LoadingState: role="status" aria-busy="true" with polite live region
- ErrorState: role="alert" announces immediately
- SuccessState: role="status" aria-live="assertive" for confirmation
```

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
