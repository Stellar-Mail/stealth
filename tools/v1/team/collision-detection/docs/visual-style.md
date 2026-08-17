# Collision Detection — Visual Style

This document describes the visual style used by the Collision Detection
component suite. All styles are folder-local inline styles — the shared design
system is not referenced so the tool stays self-contained until a future
integration issue wires it in.

## Layout

- The root container (CollisionDetectionView) renders one of four state
  components: empty, loading, error, or success.
- Each state component is a `<section>` or `<article>` with a 1 px border,
  8 px `border-radius`, and padding (1.25–2 rem).
- Max-width is unconstrained so the tool fills whatever container the host app
  provides.

## Colors

| Token                  | Hex       | Usage                              |
| ---------------------- | --------- | ---------------------------------- |
| `--cd-border`          | `#e0e0e0` | Default border and loading ring    |
| `--cd-border-dashed`   | `#ccc`    | Dashed border for empty state      |
| `--cd-text-secondary`  | `#666`    | Labels, metadata, hint text        |
| `--cd-accent`          | `#0066cc` | Loading spinner top border         |
| `--cd-error-border`    | `#e74c3c` | Error state border                 |
| `--cd-error-bg`        | `#fdf0ef` | Error state background             |
| `--cd-error-text`      | `#c0392b` | Error heading and retry border     |
| `--cd-header-bg`       | `#f9f9fb` | Success view header background     |
| `--cd-warning-border`  | `#e67e22` | Warning severity event border      |
| `--cd-warning-bg`      | `#fef9e7` | Warning severity event background  |
| `--cd-critical-border` | `#e74c3c` | Critical severity event border     |
| `--cd-critical-bg`     | `#fdf0ef` | Critical severity event background |
| `--cd-success-text`    | `#27ae60` | All-clear success message          |

## Typography

- Font: inherited from the host application.
- Heading hierarchy:
  - Tool title: `<h2>`, 1 rem, 600 weight.
  - Collision thread subject: `<strong>`, 0.9 rem.
- Body: inherited size.
- Metadata and reply details: 0.8–0.85 rem.
- Error heading: 600 weight.
- Severity badge: 0.7 rem, uppercase, 600 weight.

## Spacing

- Component padding: 1.25–2 rem.
- Internal gaps between sections: 0.5–1 rem.
- Collision event cards: 0.75 rem / 1 rem padding, 0.75 rem margin-bottom.

## Interactive elements

- **Retry button**: white background, `--cd-error-text` border and text,
  4 px `border-radius`, 0.4 rem / 1 rem padding. Changes cursor to pointer.
- **Collision event cards**: tabIndex={0} for keyboard focus, visible via
  browser default `:focus-visible` ring.
- Buttons receive focus outlines via the browser's default `:focus-visible`
  ring.

## Accessibility (visual)

- `aria-label` attributes describe each section's purpose.
- `role="alert"` on the error region for immediate screen-reader announcement.
- `aria-busy="true"` on the loading region.
- `aria-live="polite"` on the loading text so screen readers announce content
  changes without interrupting.
- Loading spinner is `aria-hidden="true"` because it is decorative.
- Focusable elements (Retry button, collision event cards) receive visible
  keyboard focus.
- Collision event cards support Enter/Space key handlers.

## States

| State   | Component                 | Visual cue                                         |
| ------- | ------------------------- | -------------------------------------------------- |
| idle    | CollisionDetectionEmpty   | Dashed border, centered placeholder message        |
| loading | CollisionDetectionLoading | CSS spinner animation + "Scanning active replies…" |
| error   | CollisionDetectionError   | Red border + background, error message, retry      |
| ready   | CollisionDetectedView     | List of collision events or all-clear message      |
