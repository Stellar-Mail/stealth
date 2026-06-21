# Contact Extractor - Visual Style Guide

This document describes the visual design patterns for the Contact Extractor tool without modifying the shared design system.

## Design Principles

1. **Isolation**: All styles are scoped to components within this tool folder
2. **Consistency**: Use design system tokens where available via Tailwind classes
3. **Clarity**: Information hierarchy and contact source indicators are clear
4. **Accessibility**: Color is never the only way to convey information

## Color System

### Contact Source Badges

Use semantic badge variants to indicate where a contact was found:

```
Header:    Default badge (primary background)
           Label: "From header"

Signature: Secondary badge (muted background)
           Label: "Signature"

Body:      Outline badge (border only)
           Label: "Body"
```

### Status Indicators

```
Success banner:    Emerald green background with matching text
                   Background: bg-emerald-50 dark:bg-emerald-950
                   Border: border-emerald-200 dark:border-emerald-800
                   Text: text-emerald-800 dark:text-emerald-200

Error banner:      Destructive red background with matching text
                   Background: bg-destructive/5
                   Border: border-destructive/20
                   Text: text-destructive

Empty state:       Muted background
                   Background: bg-muted/30
                   Text: text-muted-foreground
```

## Typography

The tool inherits typography from the design system:

- **Tool title**: text-base font-medium (CardTitle)
- **Section heading**: text-lg font-semibold
- **Contact name**: text-base font-medium
- **Field labels**: sr-only (for screen readers) + visible icon
- **Field values**: text-sm text-foreground
- **Help text**: text-xs text-muted-foreground

### Text Hierarchy

```
<h1> Tool Name (CardTitle - text-base font-medium)
<h2> Extracted Contacts (text-lg font-semibold)
     Contact Card Title (text-base font-medium)
         Field values (text-sm)
```

## Component Styling

### Cards

- **Input card**: Standard Card component from design system
- **Contact cards**: Standard Card with overflow-hidden, compact padding (p-4)

### Buttons

Buttons use the design system's button component with variants:

```
Primary (Extract):      Button with Upload icon
                         bg-primary text-primary-foreground

Outline (Fixture load): border border-input
Ghost (Clear/New):      hover:bg-accent
```

### Form Fields

- Textarea: min-h-64, font-mono, standard design system Textarea
- Label: text-sm font-medium, associated via htmlFor
- Help text: text-xs text-muted-foreground below field

### Loading State

- Spinner: Simple CSS border-based spinner (4px border, primary color)
- Centered in a card-like container
- Text: "Extracting contacts..."
- Screen reader: aria-busy="true" with sr-only announcement

### Empty/Error/Success States

All state components centered with:

- Min-height: min-h-64
- Flexbox centered: flex flex-col items-center justify-center
- Max-width: max-w-sm for text content
- 48px icon above heading

## Spacing

- Card padding: p-6 (standard) or p-4 (compact cards)
- Component gap: space-y-4 or space-y-3
- Section spacing: space-y-4 between major sections
- Button gaps: gap-3 or gap-2
- Border radius: rounded-lg (standard card)

## Dark Mode

All colors use Tailwind's dark mode syntax:

```
bg-emerald-50 dark:bg-emerald-950
text-emerald-800 dark:text-emerald-200
```

The design system handles global dark mode switching. Components automatically adapt.

## Responsive Design

### Breakpoints

The tool uses a single-column layout that works at all viewport sizes:

- **Mobile**: Full width layout, stack elements vertically
- **Tablet/Desktop**: max-w-2xl constraint, comfortable padding

### Textarea

- Full width at all breakpoints
- Monospace font for email text alignment
- Minimum height of 64 (256px) for adequate input space

## Focus States

```css
focus-visible:outline-none
focus-visible:ring-1
focus-visible:ring-ring
```

Applied by design system components automatically.

## What NOT to Change

Do NOT modify these shared design system components:

- ❌ Color tokens in design-system/styles/tokens.css
- ❌ Font settings in design-system/styles/fonts.css
- ❌ Base surface treatments
- ❌ Shared UI primitives in components/ui/

## Testing Visual Changes

When modifying styles:

1. Test in light and dark modes
2. Verify color contrast (WCAG AA minimum)
3. Check responsive behavior on mobile/tablet
4. Test focus indicators for keyboard users
5. Ensure color is not the only differentiator
6. Verify sample fixture loading works visually
