# DELIVERY — Team Inbox Rules Builder UI Surface

**Campaign labels:** GrantFox OSS · Maybe Rewarded · Official Campaign · Tooling Ecosystem · V2 Later Tool · Team Tool

---

## What was built

A fully self-contained, accessible UI surface for the Team Inbox Rules Builder tool.
All work is scoped to `tools/v2/team/team-inbox-rules-builder/`.

### Files added / changed

| File | Status | Notes |
|---|---|---|
| `components/team-inbox-rules-builder.tsx` | **New** | Top-level surface component |
| `components/index.ts` | **Updated** | Exports all components including new ones |
| `styles.css` | **New** | Tool-local CSS (`tirb-` prefix) |
| `tests/components.test.mjs` | **New** | Unit tests (node:test) |

Previously existing components (`rule-builder.tsx`, `rule-list.tsx`, `empty-state.tsx`, `loading-state.tsx`, `error-state.tsx`, `success-state.tsx`) were not modified.

---

## Component overview

### `TeamInboxRulesBuilder`

The root UI surface. Manages three views:

- **list** — shows `RuleList` (or `EmptyState` when no rules exist)
- **create** — shows `RuleBuilder` for a new rule
- **edit** — shows `RuleBuilder` pre-filled with an existing rule

Coordinates the `useRules` hook and passes callbacks down. All state
components (`LoadingState`, `ErrorState`, `SuccessState`) are used inline.

### `styles.css`

All class names are prefixed `tirb-` to guarantee zero collision with the
shared design system. Covers:

- Root shell layout and header
- Primary action button tokens
- Section heading + rule-count badge
- Focus ring override for the tool region
- Loading spinner keyframe animation
- Rule card hover style
- Condition group border colors (AND = blue, OR = purple)
- `prefers-reduced-motion` suppression
- `prefers-contrast: more` thicker outlines
- Responsive stacking at ≤ 640 px

---

## Accessibility checklist

| Criterion | Implementation |
|---|---|
| Keyboard: Tab / Shift+Tab | All interactive controls are in natural DOM order |
| Keyboard: Enter / Space | Native `<button>` and `<select>` elements |
| Keyboard: Escape | `keydown` listener closes the builder panel |
| Focus management | After save / cancel, focus returns to the "New Rule" trigger via `requestAnimationFrame` |
| Labels | Every `<input>`, `<select>`, and icon-only `<button>` has an `aria-label` |
| Heading hierarchy | `<h1>` tool title › `<h2>` section (Rules / New Rule / Edit Rule) |
| Loading announced | `role="status"` + `aria-live="polite"` on `LoadingState` |
| Error announced | `role="alert"` on `ErrorState` |
| Success announced | `role="status"` + `aria-live="assertive"` on `SuccessState` |
| Toggle switch | `role="switch"` + `aria-checked` on enable/disable button |
| Color not sole indicator | Rule enabled/disabled uses toggle + text label, not color alone |
| Reduced motion | `prefers-reduced-motion` suppresses all animations in tool region |
| High contrast | `prefers-contrast: more` increases outline width to 3 px |

---

## How to review

### 1. Static review

Read the four changed files. Verify:
- All interactive elements in `rule-builder.tsx` and `rule-list.tsx` carry `aria-label`
- `team-inbox-rules-builder.tsx` never imports from outside `tools/v2/team/team-inbox-rules-builder/`
- `styles.css` contains no `@import` of shared stylesheets

### 2. Run tests

```bash
node --test tools/v2/team/team-inbox-rules-builder/tests/components.test.mjs
```

Expected: all 25 assertions pass, 0 failures.

### 3. Mount locally (optional)

The component is isolated and not wired to the main app router.
To preview it, render it directly in a scratch file:

```tsx
import { TeamInboxRulesBuilder } from
  "./tools/v2/team/team-inbox-rules-builder/components";

// Mount anywhere — no app context required
export default function Preview() {
  return <TeamInboxRulesBuilder />;
}
```

---

## Isolation guarantee

No file outside `tools/v2/team/team-inbox-rules-builder/` was modified.
The component is not mounted in the main app shell, dashboard, or router.
