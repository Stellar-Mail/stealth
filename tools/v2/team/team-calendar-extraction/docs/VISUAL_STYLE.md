# Team Calendar Extraction Tool - Visual Style Guide

This document describes the visual design patterns for the Team Calendar Extraction tool **without modifying the shared design system**.

## Design Principles

1. **Isolation**: All styles are scoped to components within this tool folder
2. **Consistency**: Use design system tokens where available
3. **Clarity**: Visual hierarchy and status indicators are clear
4. **Accessibility**: Color is never the only way to convey information

## Color System

### Status Badges

Use semantic colors to indicate extraction status:

```css
Pending:   Yellow/Amber background with matching text
           Background: bg-yellow-100 dark:bg-yellow-900
           Text: text-yellow-800 dark:text-yellow-100

Extracted: Emerald/Green background with matching text
           Background: bg-emerald-100 dark:bg-emerald-900
           Text: text-emerald-800 dark:text-emerald-100

Failed:    Destructive red background with matching text
           Background: bg-destructive/10
           Text: text-destructive

Skipped:   Gray background with matching text
           Background: bg-gray-100 dark:bg-gray-900
           Text: text-gray-800 dark:text-gray-100
```

### Priority Indicators

```css
Low:      Muted foreground color
          color: text-muted-foreground

Normal:   Default foreground color
          color: text-foreground

High:     Amber/Warning color
          color: text-amber-600 dark:text-amber-400

Urgent:   Destructive/Red color
          color: text-destructive
```

### Category Badges

```css
Meeting:    Blue background (bg-blue-100 dark:bg-blue-900)
Deadline:   Red background (bg-red-100 dark:bg-red-900)
Reminder:   Purple background (bg-purple-100 dark:bg-purple-900)
Milestone:  Orange background (bg-orange-100 dark:bg-orange-900)
Personal:   Teal background (bg-teal-100 dark:bg-teal-900)
```

## Typography

The tool inherits typography from the design system:

- **Headlines**: text-2xl font-bold for tool title
- **Section titles**: text-lg font-semibold
- **Event titles**: text-sm font-semibold
- **Body text**: text-sm for regular content
- **Labels**: text-sm font-medium for form labels
- **Help text**: text-xs text-muted-foreground

### Text Hierarchy

```html
<h1>Tool Title (2xl font-bold)</h1>
<p>Tool Description (text-sm text-muted-foreground)</p>

<h2>Section Title (text-lg font-semibold)</h2>
<h3>Subsection (text-sm font-semibold)</h3>
<p>Body content (text-sm)</p>
```

## Component Styling

### Buttons

Buttons use the design system's button variants:

```css
Primary:      bg-primary text-primary-foreground
Secondary:    border border-input bg-background hover:bg-accent
Destructive:  bg-destructive text-destructive-foreground
Ghost:        hover:bg-accent hover:text-accent-foreground
```

### Form Fields

- Inputs: border-input bg-transparent with focus-visible:ring
- Radio groups: fieldset/legend with custom styling
- Labels: text-sm font-medium, associated with htmlFor
- Help text: text-xs text-muted-foreground below field
- Errors: bg-destructive/10 border border-destructive/20 rounded-lg

### Cards

- Event cards: border border-border bg-background rounded-lg
- Detail card: border border-border bg-background rounded-lg p-6
- Extraction history: border border-border bg-muted/20 rounded-lg

### Spacing

- Section padding: py-12 px-4 (vertical) or p-4 (all)
- Component gap: gap-3 or gap-4
- Border radius: rounded-lg (standard), rounded-2xl (accent elements)
- Max-width: max-w-2xl (forms), max-w-6xl (container), max-w-md (empty states)

## Dark Mode

All colors use Tailwind's dark mode syntax:

```css
bg-yellow-100 dark:bg-yellow-900
text-yellow-800 dark:text-yellow-100
```

The design system handles global dark mode switching. Components automatically adapt.

## Responsive Design

### Breakpoints

- Mobile: default styles
- Tablet: md: (768px)
- Desktop: lg: (1024px)

### Event List Responsiveness

```
Mobile: Single column cards
Tablet: Two column grid
Desktop: Full card layout with inline metadata
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

## What NOT to Change

Do NOT modify these shared design system components:

- ❌ Color tokens in design-system/styles/tokens.css
- ❌ Font settings in design-system/styles/fonts.css
- ❌ Base surface treatments in design-system/styles/surfaces.css
- ❌ Shared UI primitives in design-system/components/

## Custom Classes

The tool uses a minimal set of custom utility classes defined in `styles.css`. These are scoped to the tool folder and should not conflict with the design system.

## Testing Visual Changes

When modifying styles:

1. Test in light and dark modes
2. Verify color contrast (WCAG AA minimum)
3. Check responsive behavior on mobile/tablet
4. Test focus indicators for keyboard users
5. Ensure color is not the only differentiator

---

**Remember**: This tool is isolated and should not affect the main app's visual design.
