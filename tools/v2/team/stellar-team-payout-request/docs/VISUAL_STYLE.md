# Visual Style — Stellar Team Payout Request

This document describes the visual style used in this tool. It does **not** modify or override the shared design system.

## Design Principles

- **Clarity first**: financial actions need unambiguous labeling; no decorative ambiguity.
- **System-native colors**: all colors reference Tailwind / CSS design tokens (`bg-background`, `text-foreground`, `bg-primary`, etc.) to stay in sync with light/dark mode automatically.
- **Minimalism**: no extraneous chrome — each screen has one primary call-to-action.

## Color Usage

| Token | Usage |
|---|---|
| `bg-background` | Page background |
| `bg-card` | Form and list-item surfaces |
| `bg-muted` / `bg-muted/50` | Skeleton loaders, subtle row hovers |
| `text-foreground` | Primary text |
| `text-muted-foreground` | Secondary / helper text |
| `text-primary` / `bg-primary` | Submit button, selected state |
| `text-destructive` | Error text, destructive actions |
| `text-emerald-500` | Success confirmations |
| `text-amber-600` | High-priority badge |
| `border-border` | Default borders |
| `border-input` | Form field borders |
| `ring-ring` (focus) | Focus indicators on all interactive elements |

## Typography

- **Headings**: `font-semibold` / `font-bold` at `text-xl` – `text-2xl`.
- **Body**: `text-sm`, `leading-6`.
- **Labels**: `text-sm font-medium`.
- **Helper / error text**: `text-xs`.

## Spacing

- Cards and form panels: `p-6`, `rounded-xl`, `space-y-5`.
- List items: `p-4`, `rounded-xl`, `space-y-3`.
- Buttons: `px-4 py-2` (primary), `px-2 py-1` (ghost/back).

## Status Badges

Badges combine a background tint and contrasting text — never color alone.

| Status | Classes |
|---|---|
| Pending | `bg-yellow-500/10 text-yellow-600` |
| Submitted | `bg-blue-500/10 text-blue-600` |
| Confirmed | `bg-emerald-500/10 text-emerald-600` |
| Failed | `bg-destructive/10 text-destructive` |
| Cancelled | `bg-muted text-muted-foreground` |

## Priority Indicators

| Priority | Style |
|---|---|
| Low | `text-muted-foreground` |
| Normal | `text-foreground` |
| High | `text-amber-600` |
| Urgent | `text-destructive font-semibold` |

## Focus Rings

All interactive elements use `focus-visible:ring-2 focus-visible:ring-ring` so the focus indicator is visible only for keyboard navigation, not pointer interaction.

## Motion

No custom animations are added. The only motion is the Tailwind `animate-pulse` on skeleton loaders, which respects `prefers-reduced-motion` via the browser's CSS.

## Scope

These styles are **local to this tool**. No global CSS, CSS variables, or Tailwind config was modified.
