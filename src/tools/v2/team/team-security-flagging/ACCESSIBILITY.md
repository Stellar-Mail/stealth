# Team Security Flagging Tool - Accessibility Guide

This document outlines the comprehensive accessibility features built into the Team Security Flagging tool.

## WCAG 2.1 Level AA Compliance

This tool is designed to meet WCAG 2.1 Level AA standards across all success criteria.

## Keyboard Navigation

### Global Shortcuts
| Key | Action | Context |
|-----|--------|---------|
| `/` | Focus search input | Anywhere in the tool |
| `n` or `N` | Open create flag dialog | Anywhere in the tool |
| `r` or `R` | Refresh flag list | Anywhere in the tool |
| `f` or `F` | Toggle filters panel | Anywhere in the tool |
| `?` | Announce keyboard shortcuts | Anywhere in the tool |
| `Escape` | Close dialogs/modals | When a dialog is open |

### List Navigation
| Key | Action |
|-----|--------|
| `j` or `↓` | Navigate to next flag |
| `k` or `↑` | Navigate to previous flag |
| `Enter` | Open selected flag details |
| `Tab` | Move to next interactive element |
| `Shift+Tab` | Move to previous interactive element |

### Form Navigation
- **Tab**: Move between form fields
- **Shift+Tab**: Move backward through form fields
- **Enter**: Submit form (when on submit button)
- **Space**: Toggle checkboxes, activate buttons
- **Escape**: Close form dialog without saving

## Screen Reader Support

### Structure
- Proper heading hierarchy (h1 → h2 → h3)
- Semantic HTML elements (`<nav>`, `<main>`, `<article>`, `<aside>`)
- Landmark regions with clear labels

### ARIA Attributes

#### Labels
All interactive elements have accessible names:
```typescript
// Buttons
<Button aria-label="Create new flag">
  <Plus /> Create
</Button>

// Form fields
<Input aria-label="Search flags" />

// Complex widgets
<Select aria-label="Select severity level">
```

#### Descriptions
Context provided through `aria-describedby`:
```typescript
<Input
  id="title"
  aria-describedby="title-error title-help"
  aria-invalid={!!error}
/>
<p id="title-error" role="alert">{error}</p>
<p id="title-help">Minimum 3 characters</p>
```

#### Live Regions
Dynamic updates announced automatically:
```typescript
// Status updates
<div role="status" aria-live="polite">
  5 flags found
</div>

// Errors
<div role="alert" aria-live="assertive">
  Failed to load flags
</div>
```

#### States
Current state communicated clearly:
```typescript
// Loading state
<div role="status">
  <span className="sr-only">Loading flags, please wait</span>
</div>

// Selected state
<div aria-selected={isSelected}>

// Expanded state
<button aria-expanded={isOpen}>
```

### Screen Reader Announcements

The tool uses live regions to announce:
- **Success actions**: "Flag created successfully"
- **Updates**: "Flag updated successfully"
- **Deletions**: "Flag deleted successfully"
- **Filters applied**: "5 flags found matching your criteria"
- **Loading states**: "Loading flags"
- **Errors**: "Error: Failed to connect to server"
- **Navigation**: "Item 3 of 10"

## Focus Management

### Visual Focus Indicators
All focusable elements have clear focus indicators:
```css
focus-visible:outline-none 
focus-visible:ring-2 
focus-visible:ring-ring 
focus-visible:ring-offset-2
```

### Focus Trapping
When a dialog is open:
1. Focus moves to the first focusable element
2. Tab cycles through dialog elements only
3. Escape closes dialog and returns focus to trigger
4. On close, focus returns to the element that opened it

### Skip Links
Consider adding skip links when integrating:
```html
<a href="#main-content" className="sr-only focus:not-sr-only">
  Skip to main content
</a>
```

## Color and Contrast

### Contrast Ratios
All text meets WCAG AA requirements:
- **Normal text**: Minimum 4.5:1
- **Large text** (18pt+): Minimum 3:1
- **UI components**: Minimum 3:1

### Color Independence
Information is never conveyed by color alone:
- Severity levels use both color AND icons
- Status uses both color AND text labels
- Form errors use both color AND error messages

### Tested Combinations
- Light mode: All text passes WCAG AA
- Dark mode: All text passes WCAG AA
- High contrast mode: Supported via system preferences

## Form Accessibility

### Labels
All form fields have associated labels:
```typescript
<Label htmlFor="title">Title</Label>
<Input id="title" />
```

### Required Fields
Clearly marked for all users:
```typescript
<Label htmlFor="title" className="required">
  Title
  <span className="sr-only">(required)</span>
</Label>
<Input
  id="title"
  aria-required="true"
/>
```

### Error Handling
Errors are clearly communicated:
```typescript
<Input
  id="title"
  aria-invalid={!!error}
  aria-describedby={error ? "title-error" : undefined}
/>
{error && (
  <p id="title-error" role="alert" className="text-destructive">
    {error}
  </p>
)}
```

### Validation
- Real-time validation feedback
- Errors announced to screen readers
- Clear instructions for fixing errors

## Motion and Animation

### Respects User Preferences
```typescript
const prefersReducedMotion = 
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Conditionally apply animations
const duration = prefersReducedMotion ? 0 : 200;
```

### Animation Guidelines
- **Duration**: 200-300ms maximum
- **Purpose**: State changes, loading indicators
- **Essential**: No animation is required to understand content

## Mobile and Touch Accessibility

### Touch Targets
All interactive elements meet minimum size:
- **Buttons**: Minimum 44×44px
- **Links**: Minimum 44×44px tap area
- **Form fields**: Minimum 44px height

### Gestures
All gestures have keyboard equivalents:
- Swipe → Arrow keys
- Tap → Enter/Space
- Long press → Context menu key

## Testing Checklist

### Screen Readers
- ✅ NVDA (Windows)
- ✅ JAWS (Windows)
- ✅ VoiceOver (macOS/iOS)
- ✅ TalkBack (Android)

### Browsers
- ✅ Chrome + NVDA
- ✅ Firefox + NVDA
- ✅ Safari + VoiceOver
- ✅ Edge + Narrator

### Tools
- ✅ axe DevTools
- ✅ WAVE
- ✅ Lighthouse Accessibility Audit
- ✅ Keyboard navigation testing
- ✅ Color contrast analyzer

## Known Limitations

1. **Rich Text**: Currently plain text only (accessible by design)
2. **Drag & Drop**: Not implemented (keyboard alternatives provided)
3. **Charts/Graphs**: Not included in current version
4. **Video/Audio**: Not included in current version

## Accessibility Utilities

### Helper Functions
Located in `utils/accessibility.ts`:

```typescript
// Announce to screen reader
announce(message: string, priority: 'polite' | 'assertive')

// Trap focus in container
trapFocus(container: HTMLElement)

// Manage focus restoration
const focusManager = createFocusManager()
focusManager.capture()
focusManager.restore()

// Format for screen readers
formatDateForSR(date: Date)
formatNumberForSR(num: number)
```

## Future Enhancements

### Planned Features
1. **High Contrast Mode**: Enhanced theme for users with low vision
2. **Font Size Control**: User-adjustable text scaling
3. **Reading Mode**: Simplified view for cognitive accessibility
4. **Voice Input**: Speech-to-text for form inputs
5. **Haptic Feedback**: For mobile touch interactions

### Continuous Improvement
- Regular accessibility audits
- User testing with assistive technology users
- Feedback integration from accessibility community

## Resources

### Internal
- [Design System Accessibility Guide](../../design-system/ACCESSIBILITY.md)
- [Keyboard Shortcuts Documentation](./README.md#keyboard-shortcuts)

### External
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Checklist](https://webaim.org/standards/wcag/checklist)

## Reporting Accessibility Issues

If you discover an accessibility issue:
1. Check if it's already documented in Known Limitations
2. Test with the latest version
3. Report with:
   - Description of the issue
   - Steps to reproduce
   - Assistive technology used (name and version)
   - Expected vs actual behavior
   - Screenshots/recordings if applicable

## Compliance Statement

This tool aims to conform to WCAG 2.1 Level AA. We are committed to maintaining and improving accessibility for all users. Feedback and suggestions are welcome and encouraged.

**Last Updated**: June 18, 2026  
**Next Review**: Quarterly
