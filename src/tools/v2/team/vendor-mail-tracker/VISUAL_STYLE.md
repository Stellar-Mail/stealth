# Vendor Mail Tracker — Visual Style Guide

This document describes the visual language used in this tool without
modifying any shared design-system files. It is a reference for contributors
and reviewers.

---

## Typography

| Use | Class | Notes |
|-----|-------|-------|
| Tool heading (H1) | `text-base font-semibold text-foreground` | Inter, matches app chrome |
| Thread subject (unread) | `text-sm font-semibold text-foreground` | |
| Thread subject (read) | `text-sm font-medium text-foreground/80` | |
| Vendor name (sidebar) | `text-xs font-medium text-foreground/80` | |
| Section label | `text-[10px] font-semibold uppercase tracking-wider text-muted-foreground` | Matches design system pattern |
| Metadata value | `text-xs text-foreground/80 font-medium` | |
| Excerpt / secondary text | `text-[11px] text-muted-foreground` | |
| Timestamp | `text-[10px] text-muted-foreground` | `<time>` element with `dateTime` attr |

All typography inherits `--font-interface` (Inter) from the shared token. No
new font faces are introduced.

---

## Color Tokens Used

All colors reference existing CSS custom properties or standard Tailwind
oklch values that the project already defines:

| Token | Usage |
|-------|-------|
| `var(--foreground)` | Primary text, headings |
| `var(--muted-foreground)` | Secondary labels, placeholders |
| `var(--background)` | `oklch(0.18 0.005 270)` — main surface |
| `border-white/[0.07]` | Panel dividers |
| `bg-white/[0.03–0.08]` | Card/row hover states |

### Status-specific colors (local only, not added to shared tokens)

These are inline Tailwind classes using the same `oklch` color families as
`trust-badge.tsx`, but scoped to this tool's semantic domain:

| Status | Background | Border | Text |
|--------|------------|--------|------|
| open | `bg-sky-300/10` | `border-sky-300/25` | `text-sky-200` |
| awaiting-reply | `bg-amber-300/10` | `border-amber-300/25` | `text-amber-200` |
| resolved | `bg-emerald-300/10` | `border-emerald-300/25` | `text-emerald-200` |
| escalated | `bg-red-300/10` | `border-red-300/25` | `text-red-200` |
| flagged | `bg-orange-300/10` | `border-orange-300/25` | `text-orange-200` |

### Priority dots

| Priority | Dot color |
|----------|-----------|
| critical | `bg-red-400` |
| high | `bg-orange-400` |
| medium | `bg-amber-400` |
| low | `bg-zinc-400` |

---

## Surface Treatment

All card and panel surfaces use the project's glass utilities:

| Surface type | Class | Usage |
|---|---|---|
| Main dialog | `glass-strong` | Add vendor / add thread modals |
| Thread row card | `bg-white/[0.02] border border-white/[0.05]` | Lightweight, avoids heavy blur |
| Stats card | `bg-white/[0.03] border border-white/[0.07]` | Summary metric tiles |
| Metadata section | `bg-white/[0.02] border border-white/[0.07]` | Detail panel sections |
| Sidebar item (hover) | `hover:bg-white/[0.04]` | Subtle activation |
| Sidebar item (selected) | `bg-white/[0.08] border-white/20` | Active state |

No new CSS classes, keyframes, or custom properties are introduced. All
surface values are inline Tailwind opacity variants.

---

## Focus Styles

All interactive controls use the project's `glow-ring` utility:

```css
/* from interactions.css */
.glow-ring:focus-visible {
  outline: none;
  box-shadow:
    0 0 0 2px oklch(1 0 0 / 0.2),
    0 0 24px oklch(1 0 0 / 0.08);
}
```

No focus rings are suppressed or overridden. Native `<select>` and `<input>`
elements receive `glow-ring` on their wrapper or directly.

---

## Motion

All animations use `motionPresets` from `@/lib/motion-presets`:

| Animation | Preset | Used for |
|-----------|--------|----------|
| Tool entrance | `slideUp()` | Stats bar, thread list section |
| Sidebar entrance | `slideLeft()` | Left vendor panel |
| Detail panel | Spring `x: 24 → 0` | Right detail panel slide-in |
| Thread row add/remove | `patterns.listItem` | AnimatePresence list items |
| Dialog | `patterns.modal` | Both add dialogs |
| Empty / error states | `entrance.fadeIn()` | Contextual state transitions |

All motion respects `prefers-reduced-motion` automatically via the preset
system. The `data-motion="lower"` data attribute is also honored.

---

## Unread Indicator

Unread threads receive:
- A 1.5px amber left border: `border-l-2 border-l-amber-400/60`
- A 6px dot positioned absolutely at `left: -3px` (aria-hidden)
- Bold subject text: `font-semibold`

The unread count badge uses `bg-amber-400/90 text-black` (high-contrast
on the dark background, meeting WCAG AA for this size).

---

## Accessibility Notes

This section describes choices made for WCAG compliance. Full validation
requires manual testing with assistive technologies.

### What was done

- All `<button>` and `<a>` elements have visible labels (text or `aria-label`)
- Icon-only buttons carry `aria-label`; icons are `aria-hidden`
- Thread rows are `role="button" tabIndex={0}` with `aria-pressed` and `aria-label`
- List containers are `role="list"` with `aria-label`
- Sort buttons use `aria-sort` (`ascending` / `descending` / `none`)
- Stats region uses `role="region" aria-label`
- Dialogs use `role="dialog" aria-modal aria-labelledby`
- Form fields have `<label htmlFor>`, `aria-required`, `aria-invalid`, `aria-describedby`
- Validation errors use `role="alert"` for live announcement
- A skip-to-content link is provided at the top of the tool
- Thread count changes use `aria-live="polite"` on the list container
- Skeleton loading states use `aria-busy="true"` and `aria-label`
- Color is never the sole conveyor of meaning (status badges include text labels)

### Known limitations

- Board view drag-and-drop is not implemented (columns are read-only kanban)
- Mobile sidebar requires a separate trigger; currently hidden at `< lg`
- The "Open in Mail" action is disabled until the main-app integration is built
