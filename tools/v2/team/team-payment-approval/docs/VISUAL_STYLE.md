# Team Payment Approval Tool - Visual Style Guide

This document describes the visual design patterns for the Team Payment Approval tool **without modifying the shared design system**.

## Design Principles

1. **Isolation**: All styles are scoped to components within this tool folder
2. **Consistency**: Use design system tokens where available
3. **Clarity**: Visual hierarchy and status indicators are clear
4. **Accessibility**: Color is never the only way to convey information

## Color System

### Status Badges

Use semantic colors to indicate payment status:

```
Pending:  Yellow/Amber background with matching text
          Background: bg-yellow-100 dark:bg-yellow-900
          Text: text-yellow-800 dark:text-yellow-100

Approved: Emerald/Green background with matching text
          Background: bg-emerald-100 dark:bg-emerald-900
          Text: text-emerald-800 dark:text-emerald-100

Rejected: Destructive red background with matching text
          Background: bg-destructive/10
          Text: text-destructive

Expired:  Gray background with matching text
          Background: bg-gray-100 dark:bg-gray-900
          Text: text-gray-800 dark:text-gray-100
```

### Priority Indicators

```
Low:      Muted foreground color
          color: text-muted-foreground

Normal:   Default foreground color
          color: text-foreground

High:     Amber/Warning color
          color: text-amber-600 dark:text-amber-400

Urgent:   Destructive/Red color
          color: text-destructive
```

## Typography

The tool inherits typography from the design system:

- **Headlines**: mail-preview-heading class (from design system)
- **Body text**: text-sm, text-base for regular content
- **Labels**: text-sm font-medium for form labels
- **Help text**: text-xs text-muted-foreground

### Text Hierarchy

```html
<h1>Tool Title (2xl font-bold)</h1>
<p>Tool Description (text-sm text-muted-foreground)</p>

<h2>Section Title (text-lg font-semibold)</h2>
<h3>Subsection (text-base font-semibold)</h3>
<p>Body content (text-sm)</p>
```

## Component Styling

### Buttons

Buttons use the design system's button component with variants:

```
Primary:      bg-primary text-primary-foreground
Secondary:    bg-secondary text-secondary-foreground
Destructive:  bg-destructive text-destructive-foreground
Ghost:        hover:bg-accent hover:text-accent-foreground
Outline:      border border-input
```

Special variants for approval workflow:

```
Approve:  bg-emerald-600 hover:bg-emerald-700 (success green)
Reject:   bg-destructive hover:bg-destructive/90 (error red)
```

### Form Fields

- Inputs: border-input bg-transparent with focus-visible:ring
- Labels: text-sm font-medium, associated with htmlFor
- Help text: text-xs text-muted-foreground below field
- Errors: p-3 rounded-lg bg-destructive/10 border border-destructive/20

### Surfaces

- Cards: border border-border bg-background rounded-lg
- Tiles: glass-tile from design system (if available)
- Modals: bg-background with border border-border
- Overlays: Use design system modal treatment

### Spacing

- Section padding: py-12 px-4 (vertical) or p-4 (all)
- Component gap: gap-3 or gap-4
- Border radius: rounded-lg (standard), rounded-2xl (accent elements)
- Max-width: max-w-2xl (forms), max-w-6xl (container), max-w-md (empty states)

## Dark Mode

All colors use Tailwind's dark mode syntax:

```
bg-yellow-100 dark:bg-yellow-900
text-yellow-800 dark:text-yellow-100
```

The design system handles global dark mode switching. Components automatically adapt.

## Responsive Design

### Breakpoints

- Mobile: default styles
- Tablet: md: (768px)
- Desktop: lg: (1024px)

### Table Responsiveness

```
Mobile: Stack/scroll table horizontally
Tablet: Show simplified columns
Desktop: Full table with all columns
```

### Button Layout

```
Mobile: Full width or stacked
Desktop: Row layout with gap-3
```

## State Styles

### Disabled State

```css
disabled:opacity-50
disabled:cursor-not-allowed
disabled:pointer-events-none
```

### Hover/Active States

```css
hover:bg-accent (for backgrounds)
hover:text-foreground (for text)
active:bg-muted (for pressed state)
```

### Focus States

```css
focus-visible:outline-none
focus-visible:ring-2
focus-visible:ring-ring
focus-visible:border-ring
```

## Loading States

- Skeleton loaders with animate-pulse
- Preserving layout space during load (prevent CLS)
- Decorative elements marked with aria-hidden="true"

## Empty/Error/Success States

All state components centered with:

- Max-width: max-w-md
- Flexbox centered: flex flex-col items-center justify-center
- Vertical padding: py-12
- Horizontal padding: px-4

Icon styling (when provided):

```css
glass-tile mb-6 flex size-14 items-center justify-center rounded-2xl
```

Colors for icons:

- Empty: text-foreground
- Loading: text-foreground (skeleton)
- Error: text-destructive
- Success: text-emerald-500

## Custom Utility Classes

Only create component-level utility classes if needed:

```css
.glass-tile {
  @apply bg-opacity-50 backdrop-blur-sm;
}

.mail-preview-heading {
  @apply text-sm font-semibold uppercase tracking-wider;
}
```

These should be scoped to the tool folder if not in the design system.

## What NOT to Change

Do NOT modify these shared design system components:

- ❌ Color tokens in design-system/styles/tokens.css
- ❌ Font settings in design-system/styles/fonts.css
- ❌ Base surface treatments in design-system/styles/surfaces.css
- ❌ Interaction patterns in design-system/styles/interactions.css
- ❌ Shared UI primitives in design-system/components/

## Implementing Custom Styles

If you need tool-specific styles:

1. Create a `styles.css` file in the tool folder
2. Use Tailwind classes or scoped CSS modules
3. Keep styles isolated to tool components
4. Document custom classes here

Example:

```css
/* tools/v2/team/team-payment-approval/styles.css */

.payment-approval-form {
  @apply space-y-6;
}

.payment-row {
  @apply hover:bg-muted/50 transition-colors focus-within:ring-2;
}
```

## Testing Visual Changes

When modifying styles:

1. Test in light and dark modes
2. Verify color contrast (WCAG AA minimum)
3. Check responsive behavior on mobile/tablet
4. Test focus indicators for keyboard users
5. Ensure color is not the only differentiator

---

**Remember**: This tool is isolated and should not affect the main app's visual design.
