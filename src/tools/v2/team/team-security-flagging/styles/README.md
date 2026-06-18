# Team Security Flagging Tool - Visual Style Guide

This document describes the visual styling patterns used in the Team Security Flagging tool. **Important:** This tool does not modify the shared design system. All styles are self-contained within the tool's components.

## Design Principles

### 1. Consistency with Existing Design System

- Uses Tailwind CSS classes aligned with the project's design tokens
- Leverages Radix UI primitives for accessible components
- Follows the existing color palette and spacing scale

### 2. Accessibility-First

- WCAG 2.1 AA compliant color contrast ratios
- Focus indicators on all interactive elements
- Clear visual hierarchy
- Support for reduced motion preferences

### 3. Status Visualization

Clear visual communication through color coding:

- **Severity levels** use a traffic light system
- **Status badges** provide at-a-glance state information
- **Icons** supplement color for color-blind accessibility

## Color Palette

### Severity Colors

Using semantic color classes from the design system:

```typescript
{
  low: 'text-blue-600 bg-blue-50 border-blue-200',
  medium: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  high: 'text-orange-600 bg-orange-50 border-orange-200',
  critical: 'text-red-600 bg-red-50 border-red-200',
}
```

### Status Colors

```typescript
{
  pending: 'text-gray-600 bg-gray-50 border-gray-200',
  reviewing: 'text-blue-600 bg-blue-50 border-blue-200',
  resolved: 'text-green-600 bg-green-50 border-green-200',
  dismissed: 'text-gray-600 bg-gray-50 border-gray-200',
}
```

### State Colors

- **Success**: Green (`green-600`, `green-50`, `green-200`)
- **Error**: Destructive theme color
- **Info**: Blue (`blue-600`, `blue-50`)
- **Warning**: Yellow (`yellow-600`, `yellow-50`)

## Typography

### Hierarchy

1. **Page Title**: `text-2xl font-semibold`
2. **Section Heading**: `text-lg font-semibold`
3. **Card Title**: `text-base font-semibold`
4. **Body Text**: `text-sm`
5. **Caption/Meta**: `text-xs text-muted-foreground`

### Font Families

Inherits from the design system's font stack (defined in global styles).

## Spacing

Uses the design system's spacing scale:

- **Component padding**: `p-4` or `p-6`
- **Section spacing**: `space-y-4` or `space-y-6`
- **Element gaps**: `gap-2` or `gap-3`

## Layout Patterns

### Three-Column Layout

```
┌─────────────────────────────────────────────────┐
│ Header (full width)                             │
├───────────┬───────────────────┬─────────────────┤
│ Filters   │ Flag List         │ Detail Panel    │
│ (256px)   │ (flex-1)          │ (384px)         │
│           │                   │ (conditional)   │
└───────────┴───────────────────┴─────────────────┘
```

### Responsive Behavior

- **Desktop (>1024px)**: Three-column layout
- **Tablet (768-1023px)**: Two-column (filters collapsible)
- **Mobile (<768px)**: Single column with modal details

## Components

### Cards

```css
rounded-lg border border-border bg-card p-4
hover:border-primary/50 hover:shadow-md
transition-all
```

### Badges

```css
inline-flex items-center gap-1 px-2 py-1
rounded-full text-xs font-medium border
```

### Buttons

Uses the design system's Button component with variants:

- **Primary**: Default action buttons
- **Outline**: Secondary actions
- **Ghost**: Tertiary/icon buttons
- **Destructive**: Delete/dangerous actions

### Form Elements

Uses the design system's form components:

- Input
- Textarea
- Select
- Checkbox
- Label

## Interactive States

### Focus

```css
focus-visible:outline-none
focus-visible:ring-2
focus-visible:ring-ring
focus-visible:ring-offset-2
```

### Hover

```css
hover:bg-accent hover:text-accent-foreground
transition-colors
```

### Active/Selected

```css
border-primary bg-accent/30
```

### Disabled

```css
disabled:pointer-events-none disabled:opacity-50
```

## Accessibility Features

### Screen Reader Only Text

```css
sr-only
absolute -left-[10000px] h-[1px] w-[1px] overflow-hidden
```

### Live Regions

Created programmatically with:

- `role="status"`
- `aria-live="polite"` or `aria-live="assertive"`
- `aria-atomic="true"`

### ARIA Attributes

All interactive elements include appropriate ARIA attributes:

- `aria-label` for buttons and controls
- `aria-describedby` for form field errors
- `aria-invalid` for validation states
- `aria-required` for required fields
- `aria-expanded` for collapsible sections

## Animation

### Reduced Motion

Respects `prefers-reduced-motion` user preference. All animations are:

- Subtle (200-300ms duration)
- Purposeful (indicate state changes)
- Skippable (non-essential to understanding)

### Transitions

```css
transition-colors duration-200
transition-all duration-200
```

### Loading States

```css
animate-pulse  /* For skeleton loaders */
animate-spin   /* For spinner icons */
```

## Icons

### Icon Library

Uses `lucide-react` for consistent iconography:

- **Size**: `size-4` (16px) or `size-5` (20px)
- **Spacing**: `mr-2` when paired with text
- **Accessibility**: Always marked with `aria-hidden="true"`

### Semantic Icons

- **Severity**: Info, AlertTriangle, AlertCircle, AlertOctagon
- **Actions**: Edit, Trash2, CheckCircle, XCircle
- **Navigation**: Plus, RefreshCw, X, Search

## Dark Mode Support

All colors use the design system's CSS custom properties, which automatically adapt to dark mode:

- `bg-background` → Dark or light background
- `text-foreground` → Dark or light text
- `border-border` → Dark or light borders
- etc.

## Z-Index Layers

```
1. Base content: z-0 (default)
2. Sticky headers: z-10
3. Dropdowns: z-20 (Radix UI default)
4. Modals: z-50 (Radix UI default)
5. Toasts: z-100
```

## Performance Considerations

### CSS-in-JS

Not used. All styling through Tailwind utility classes for optimal performance.

### Bundle Size

- Component library: Tree-shakeable
- Icons: Individual imports only
- No custom CSS files

## Browser Support

Targets the same browsers as the main application:

- Chrome/Edge (last 2 versions)
- Firefox (last 2 versions)
- Safari (last 2 versions)

## Future Considerations

When integrating with the main app:

1. Ensure theme tokens are synchronized
2. Test dark mode thoroughly
3. Verify responsive breakpoints match
4. Validate accessibility in production context
