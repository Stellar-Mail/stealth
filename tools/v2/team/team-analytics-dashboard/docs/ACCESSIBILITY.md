# Team Analytics Dashboard — Accessibility Guide

This document outlines the accessibility features, screen-reader semantics, and keyboard navigation patterns implemented in the Team Analytics Dashboard UI surface.

## Overview

The Team Analytics Dashboard is designed to be fully navigable via keyboard and assistive technologies, adhering to WCAG 2.1 AA guidelines. The interface provides clear semantic structure, explicit state labeling, and focus management without relying solely on visual styling.

## Keyboard Navigation

### Global & Dashboard Header

- **Tab / Shift+Tab**: Navigate between interactive buttons, search inputs, status filter pills, tabs, table headers, and rows.
- **Enter / Space**: Activate buttons, select a tab, trigger table column sorting, or select an interactive table row / snapshot card.
- **Escape**: Dismiss active success notifications or clear focused states.

### View Mode Navigation (Tabs)

- **Arrow Left / Arrow Right**: Move focus and active selection between the `Member Workload` and `Team Snapshots` tabs.
- **Home / End**: Jump focus to the first or last tab in the tablist.

### Member Table & Sort Headers

- **Tab**: Focus sortable column headers and interactive row items.
- **Enter / Space on Sort Header**: Toggles column sort order (`ascending` ↔ `descending`) or sets initial sort.
- **Enter / Space on Row**: Selects the focused member for detail inspection when selection callbacks are provided.

### Snapshot Cards List

- **Tab**: Focus individual snapshot cards.
- **Enter / Space**: Activates the selected snapshot card.

## Screen Reader Support

### ARIA Live Regions & State Announcements

- **Loading State** (`<LoadingState />`):
  - Uses `role="status"`, `aria-live="polite"`, and `aria-busy="true"`.
  - Assistive technologies announce loading state transitions without interrupting current user speech.
- **Error State** (`<ErrorState />`):
  - Uses `role="alert"` and `aria-live="assertive"`.
  - Immediately announces load failures and network errors along with actionable retry instructions.
- **Empty State** (`<EmptyState />`):
  - Uses `role="status"` and `aria-labelledby` referencing a descriptive heading.
  - Communicates when no members or snapshots match current filter/search criteria.
- **Success Notifications** (`<SuccessState />`):
  - Uses `role="status"` and `aria-live="polite"` to confirm actions (e.g., refresh complete, sample data loaded).

### Labels, Descriptions, and Edge-Case Semantics

- **Away Members & Null Response Times**:
  - When a member's status is `away` or `avgResponseTimeHours` is `null`, the table and summary display `"N/A"` with an explicit `aria-label="Not applicable"`.
  - This prevents assistive technologies from reading ambiguous zero values or blank table cells.
- **Sortable Columns**:
  - All sort headers carry dynamic `aria-sort` attributes (`ascending`, `descending`, or `none`).
- **Filter Buttons**:
  - Filter pills use `aria-pressed="true"` / `"false"` within `role="group"` container elements (`aria-label="Filter members by status"` and `"Filter snapshots by status"`).
- **Status Badges & Warning Flags**:
  - Every status badge combines text text and symbolic icons (`✓`, `⚠️`, `ℹ️`, `⏸️`, `👀`, `🛑`).
  - Never relies on color alone to convey workload overload, SLA breaches, or blocked team states.

## Visual Accessibility

### Focus Management & High-Contrast Rings

- All interactive controls (buttons, tabs, table sort headers, input boxes) use visible high-contrast focus rings (`focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none`).
- Focus indicators remain visible against both light and dark mode backgrounds.

### Color Contrast & Typography

- Semantic foreground and background colors meet WCAG 2.1 AA contrast requirements (4.5:1 minimum contrast ratio for normal text).
- Destructive SLA breach alerts and overload warnings use high-contrast foreground text paired with tinted backgrounds.
