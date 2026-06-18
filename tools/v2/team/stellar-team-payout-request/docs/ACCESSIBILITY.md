# Accessibility — Stellar Team Payout Request

This document describes the accessibility features built into this tool.

## Target

WCAG 2.1 Level AA.

## Keyboard Navigation

| Key | Action |
|---|---|
| `Tab` / `Shift+Tab` | Move focus between all interactive elements |
| `Enter` / `Space` | Activate buttons, toggle radio options |
| `Arrow keys` | Navigate priority radio group |
| `Escape` | Cancel form / back to list (button receives focus) |

## Focus Management

- A visible focus ring (`focus-visible:ring-2 focus-visible:ring-ring`) is shown on all buttons, inputs, selects, and links when navigated by keyboard.
- Focus order matches the visual reading order.
- After submitting a form, a status region announces the result.

## Screen Reader Support

### ARIA Roles & Live Regions

| Component | Role / Live Region |
|---|---|
| `LoadingState` | `role="status" aria-live="polite" aria-busy="true"` |
| `ErrorState` | `role="alert"` (announces immediately) |
| `EmptyState` | `role="status"` |
| `SuccessState` | `role="status" aria-live="assertive"` |
| Global status region | `role="region" aria-live="polite"` (in main tool component) |

### Form Labels

- Every `<input>`, `<textarea>`, and `<select>` has a `<label>` connected via `htmlFor` / `id`.
- Required fields carry `aria-required="true"` and a visible asterisk (`aria-hidden="true"`).
- Validation error messages are linked to their field via `aria-describedby` and announced with `role="alert"`.
- The priority radio group uses `<fieldset>` + `<legend>` and `role="radiogroup"`.
- Helper text (e.g., "56-character public key") is linked via `aria-describedby`.

### Decorative Elements

- Emoji / icon elements that are purely decorative carry `aria-hidden="true"`.
- Skeleton loader rows carry `aria-hidden="true"`; the screen-reader message is in an `sr-only` span.

### Status Badges

- Status badges include an `aria-label` (e.g., `Status: Confirmed`) so they are read in context.
- Priority badges include an `aria-label` (e.g., `Priority: urgent`).
- Color is **never the only** way information is conveyed; text labels accompany every color indicator.

### Stellar Address Truncation

- Addresses displayed in the list are visually truncated (`…`); the full address is in the row's `aria-label`.

## Color Contrast

All text/background combinations use Tailwind semantic tokens that meet WCAG AA contrast ratios (4.5:1 for body text, 3:1 for large text and UI components). No hardcoded hex values are used.

## Motion

No custom animations are introduced. The `animate-pulse` skeleton uses CSS that browsers suppress under `prefers-reduced-motion: reduce`.

## Testing Checklist

- [ ] Keyboard-only navigation through full form flow (no mouse)
- [ ] VoiceOver (macOS) reads form labels and error messages correctly
- [ ] NVDA (Windows) announces state transitions
- [ ] Error summary is announced when form is submitted with invalid data
- [ ] Success state is announced after submission
- [ ] Loading skeleton is not read aloud (aria-hidden)
- [ ] Priority radio group navigable with arrow keys

## Resources

- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
