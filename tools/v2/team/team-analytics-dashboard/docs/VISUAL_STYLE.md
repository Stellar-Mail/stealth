# Team Analytics Dashboard — Visual Style & Component Documentation

This document describes the visual design system, styling tokens, and layout guidelines for the Team Analytics Dashboard local UI surface.

## Design System Compliance

All components in this tool are styled exclusively using the application's existing Tailwind CSS semantic design tokens. **No changes were made to the shared design system or global application styles.**

### Core Style Tokens Used

- **Surfaces & Containers**: `bg-background`, `bg-card`, `bg-muted/50`, `bg-muted/30`, `border-border`
- **Text & Labels**: `text-foreground`, `text-muted-foreground`, `text-card-foreground`
- **Primary Accents**: `bg-primary`, `text-primary`, `text-primary-foreground`, `border-primary`
- **Warnings & Destructive Alerts**: `bg-destructive`, `text-destructive`, `text-destructive-foreground`, `border-destructive`
- **Focus Rings**: `focus-visible:ring-primary`, `focus-visible:ring-destructive`, `focus-visible:ring-2`

## Component Visual Patterns

### 1. Dashboard Header & Subtitle

- Uses `<header>` with standard spacing (`pb-4 border-b border-border`) to establish context.
- Heading `h1` is styled with `text-2xl font-bold tracking-tight`.
- Reporting period and team identifiers use muted text with bold semantic foreground highlights.

### 2. View Mode Tabs (Tablist)

- Navigation bar styled with `border-b border-border`.
- Tab items use `-mb-px border-b-2 px-4 py-2.5 text-sm font-medium`.
- Active tab displays a solid bottom accent (`border-primary text-primary font-semibold`), while inactive tabs use transparent borders with hover foreground transitions.

### 3. Summary Metric Cards

- Rendered in a responsive grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`).
- Metric titles use `text-xs font-medium uppercase tracking-wider text-muted-foreground` for scannability.
- Large numeric counts display at `text-2xl font-bold` with baseline alignment for subtitle text.
- Special alert banner for SLA breaches uses a tinted background (`bg-destructive/10 border-destructive/30 text-destructive`) to draw immediate reviewer attention without visual clutter.

### 4. Member Performance Table

- Wrapped in an overflowing border container (`border border-border rounded-lg bg-card shadow-sm`).
- Table header row uses `bg-muted/50 border-b border-border`.
- Column sort headers display uppercase tracking (`text-xs font-medium uppercase tracking-wider`).
- Sort direction indicator uses subtle arrows (`▲`, `▼`, or `↕`) that highlight on hover.
- Rows feature interactive hover highlights (`hover:bg-muted/50`) and explicit focus outline borders when selectable.
- Away member metrics with null response times display a clear `"N/A"` label in place of numerical zeros.

### 5. Snapshot Cards Grid

- Displayed in a responsive 2-column card grid (`grid-cols-1 md:grid-cols-2 gap-4`).
- Each card incorporates a 3-column metric breakdown (`Threads`, `Backlog`, `Avg Response`) framed in subtle gray rounded containers (`bg-muted/50 p-2 rounded`).
- Footer displays source report metadata in a monospace font (`font-mono`) alongside explicit `Review Required` warning pills when SLA breaches are present.

## Status Badge Palettes & Iconography

To ensure accessibility and visual clarity, all member and snapshot statuses use combined text and iconography:

| Status              | Component | Visual Token                                            | Icon | Description                               |
| :------------------ | :-------- | :------------------------------------------------------ | :--- | :---------------------------------------- |
| **Active**          | Member    | `bg-green-500/15 text-green-600 dark:text-green-400`    | ✓    | Standard workload                         |
| **Overloaded**      | Member    | `bg-destructive/15 text-destructive`                    | ⚠️   | High open threads or >2 SLA breaches      |
| **Underutilized**   | Member    | `bg-blue-500/15 text-blue-600 dark:text-blue-400`       | ℹ️   | Zero open backlog with available capacity |
| **Away**            | Member    | `bg-muted text-muted-foreground`                        | ⏸️   | Offline / no email activity               |
| **Healthy**         | Snapshot  | `bg-green-500/15 text-green-600 dark:text-green-400`    | ✓    | Team SLA and backlog targets met          |
| **Watch**           | Snapshot  | `bg-yellow-500/15 text-yellow-600 dark:text-yellow-400` | 👀   | Approaching SLA threshold                 |
| **Needs Attention** | Snapshot  | `bg-orange-500/15 text-orange-600 dark:text-orange-400` | ⚠️   | SLA breached, review required             |
| **Blocked**         | Snapshot  | `bg-destructive/15 text-destructive`                    | 🛑   | Missing source data or blocked workflow   |

## Dark Mode Compatibility

All components automatically adapt to dark mode through semantic design tokens and explicit dark-theme overrides (`dark:text-green-400`, `dark:text-blue-400`, `dark:text-yellow-400`, `dark:text-orange-400`), preserving 4.5:1 minimum contrast ratios across all states.
