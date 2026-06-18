# Team Inbox Rules Builder - Accessibility Guide

## Keyboard Navigation

| Key           | Action                         |
| ------------- | ------------------------------ |
| Tab           | Move forward between elements  |
| Shift+Tab     | Move backward between elements |
| Arrow Up/Down | Navigate rule list             |
| Enter/Space   | Activate selected element      |
| Escape        | Close builder / cancel         |
| Ctrl+S        | Save current rule              |
| Ctrl+E        | Toggle rule enabled/disabled   |

## Screen Reader Support

- Semantic HTML: `list`, `listitem`, `form`, `fieldset`, `legend`
- ARIA labels on all interactive controls
- `role="status"` with `aria-live="polite"` for loading
- `role="alert"` for error messages
- `aria-live="assertive"` for success confirmations
- Clear heading hierarchy (h1 → h2 → h3)
- Status indicators conveyed with text + icon (not color alone)

## Focus Management

- Focus trap in modal/builder views
- Focus returns to trigger element on close
- Visible focus ring on all interactive elements
- Tab order matches visual layout

## Visual Accessibility

- WCAG AA contrast ratios (4.5:1 normal, 3:1 large text)
- `prefers-reduced-motion` respected
- Text scaling supported up to 200%
- No information conveyed by color alone

## Testing Accessibility

1. Navigate entire tool using only keyboard (Tab, Shift+Tab, Arrows, Enter)
2. Test with NVDA (Windows), VoiceOver (Mac), or Orca (Linux)
3. Verify focus indicators visible in high-contrast mode
4. Zoom to 200% and verify layout remains usable
5. Enable reduced motion and verify animations disabled
