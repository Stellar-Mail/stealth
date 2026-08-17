# Visual Style

## Goal

The Team Workload Balancer follows the existing application design language without introducing new global styles or modifying the shared design system.

All styling remains local to this tool.

## Design Tokens

The interface references existing CSS custom properties.

Examples include:

- `--background`
- `--foreground`
- `--card`
- `--border`
- `--primary`
- `--primary-foreground`
- `--accent`
- `--destructive`
- `--ring`
- `--shadow-elegant`
- `--gradient-glass`

No tokens are overridden.

## Typography

Uses the shared interface font.

Recommended scale:

| Element         | Style                           |
| --------------- | ------------------------------- |
| Page title      | `text-lg font-semibold`         |
| Section heading | `text-base font-semibold`       |
| Card title      | `text-sm font-semibold`         |
| Supporting text | `text-sm text-muted-foreground` |
| Labels          | `text-xs`                       |

## Spacing

Uses the standard spacing scale.

Examples:

- `gap-2`
- `gap-4`
- `gap-6`
- `p-4`
- `p-6`

No custom spacing values are introduced.

## Border Radius

Recommended usage:

- `rounded-md`
- `rounded-lg`
- `rounded-xl`

## Component States

### Empty

Displays guidance encouraging creation or loading of workload assignments.

### Loading

Skeleton placeholders represent workload cards.

Loading containers expose `aria-busy="true"`.

### Error

Displays a descriptive message and retry action.

Errors use the destructive color token and `role="alert"`.

### Success

Displays:

- workload summary
- team member cards
- workload indicators

## Icons

Decorative icons are marked as hidden from assistive technologies.

Meaningful icons require accessible labels.

## Responsive Layout

The interface should:

- scale to smaller screens
- maintain readable spacing
- preserve keyboard navigation
- avoid horizontal scrolling whenever possible

## Future Enhancements

Future issues may introduce:

- drag-and-drop workload balancing
- workload charts
- animated transitions
- dashboard integration

These are intentionally excluded from this issue.
