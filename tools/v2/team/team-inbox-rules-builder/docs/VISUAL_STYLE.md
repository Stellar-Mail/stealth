# Team Inbox Rules Builder - Visual Style Guide

## Design Principles

- Use existing design system tokens (colors, spacing, typography)
- No modifications to the shared design system
- Tailwind CSS for component styling
- Dark mode support via `dark:` prefix

## Component Styling

### Rule List

- Card-based layout with hover effects
- Status indicator (active/inactive) with icon + color
- Priority shown as badge
- Search input with icon

### Rule Builder

- Form with clear section grouping
- Condition rows with AND/OR group toggles
- Action cards with icon and description
- Drag handle for reordering conditions
- Validation errors inline under fields

### Condition Groups

- AND group: blue border/background
- OR group: purple border/background
- Nested indentation for readability
- Remove button with confirmation

### Actions

- Icon per action type
- Config form inline within action card
- Remove button on hover

### State Components

- Empty state: centered with illustration, CTA button
- Loading state: spinner with message
- Error state: alert with retry button
- Success state: checkmark with auto-dismiss

## Colors

- Semantic colors from design system
- Status: red (error), green (success), blue (info), yellow (warning)
- Priority: low (gray), normal (blue), high (orange), urgent (red)
- Condition group: AND (blue), OR (purple)

## Typography

- Headings: font-semibold, existing size scale
- Body: font-normal, text-sm
- Labels: text-xs font-medium
- Code/monospace: font-mono for operators

## Responsive Breakpoints

- Mobile: single column, stacked
- Tablet (md: 768px): two-column layout for builder
- Desktop (lg: 1024px): full layout with side panel

## Dark Mode

- Define all colors with `dark:` variants
- Use design system dark mode tokens
- Test all states in both modes
