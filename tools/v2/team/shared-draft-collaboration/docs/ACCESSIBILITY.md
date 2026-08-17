# Accessibility Guidelines - Shared Draft Collaboration

## Overview

The Shared Draft Collaboration UI is built with accessibility as a first-class concern. This document describes the accessibility features and guidelines for maintaining them.

## WCAG 2.1 Level AA Compliance

All components are designed to meet WCAG 2.1 Level AA standards.

### Color Contrast

- All text meets minimum 4.5:1 contrast ratio for normal text
- All interactive elements clearly distinguish focus state
- Active state uses color AND visual indicator (not color alone)
- Draft list uses color-coded indicators with text labels

### Keyboard Navigation

- All interactive elements are keyboard accessible
- Tab order is logical and intuitive
- Focus indicators are visible (ring-2 focus-within style)
- No keyboard traps exist
- Escape key would dismiss modals (when integrated)

### Screen Readers

- All components use semantic HTML (`<button>`, `<ul>`, `<li>`, `<article>`, etc.)
- Icon-only elements have `aria-label` or `aria-hidden` as appropriate
- State changes announce via `aria-live` and `role="status"`
- List structure uses proper `role="list"` and `role="listitem"`
- Loading state uses `aria-busy="true"` for screen reader users

### Focus Management

- Focus indicators are always visible
- Focus is properly managed in list items
- Button interactions maintain focus context
- Entry components use `focus-within` for container focus styling
- Tab order follows visual reading order

## Component-Specific Guidelines

### SharedDraftEmptyState

- Uses semantic `<h2>` for hierarchy
- `role="status"` announces this is informational
- Clear CTA button with descriptive label
- Encourages collaboration messaging

### SharedDraftLoadingState

- `role="status"` with `aria-busy="true"`
- Announces "Loading drafts..." for context
- Skeleton components don't trap focus

### SharedDraftErrorState

- Uses `<Alert>` component with `role="alert"`
- Error message is descriptive and actionable
- Retry button clearly labeled

### SharedDraftEntry

- Uses semantic `<article>` for draft items
- Icons have `aria-hidden="true"` since text provides context
- Edit button has descriptive aria-label
- Timestamps accessible to screen readers
- Collaborator count clearly announced
- Active badge uses both visual and text indicator

### SharedDraftList

- Uses semantic `<ul>` and `<li>` elements
- List has descriptive aria-label
- Count summary helps screen reader users understand size
- Active draft count included in summary
- New Draft button is clearly labeled

## Testing Accessibility

### Manual Testing Checklist

- [ ] Keyboard navigation works (Tab through all controls)
- [ ] Focus indicators are visible
- [ ] Screen reader announces all content meaningfully
- [ ] Color contrast is sufficient
- [ ] All buttons have descriptive labels
- [ ] No information conveyed by color alone
- [ ] Active state is clear to all users

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
4. Tab through all interactive elements
5. Test state changes (loading → success, etc.)
6. Verify all buttons have meaningful names
7. Check that draft information is complete
8. Confirm active state is announced

### Collaboration-Specific Testing

- [ ] Collaborator count is announced clearly
- [ ] Active draft indicator is accessible
- [ ] Timestamps are readable by screen readers
- [ ] Draft titles are unique and descriptive
- [ ] No information lost for users with visual impairments

## Real-Time Collaboration Considerations

When integrated with real-time collaboration features:

- Announce new comments/changes to screen readers
- Maintain focus during updates
- Provide alternative to highlighting for active sections
- Allow screen reader users to navigate collaborator cursors

## Known Limitations

None at this time. All components meet accessibility standards.

## Future Improvements

- Add animation preferences support (prefers-reduced-motion)
- Add high-contrast mode support
- Add text size scaling support
- Collaboration cursor announcements (when real-time features added)
- Live region announcements for drafts being edited

## References

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [Inclusive Components](https://inclusive-components.design/)
- [WebAIM: Screen Reader Testing](https://webaim.org/articles/screenreader_testing/)
