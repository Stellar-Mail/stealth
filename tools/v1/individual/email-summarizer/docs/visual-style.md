# Email Summarizer — Visual Style

This document describes the visual style used by the Email Summarizer component
suite. All styles are folder-local inline styles — the shared design system is
not referenced so the tool stays self-contained until a future integration
issue wires it in.

## Layout

- The root container (EmailSummarizer) renders one of four state components:
  empty, loading, error, or success.
- Each state component is a `<section>` or `<article>` with a 1 px border,
  8 px `border-radius`, and padding (1.25–2 rem).
- Max-width is unconstrained so the tool fills whatever container the host app
  provides.

## Colors

| Token                 | Hex       | Usage                           |
| --------------------- | --------- | ------------------------------- |
| `--es-border`         | `#e0e0e0` | Default border and loading ring |
| `--es-border-dashed`  | `#ccc`    | Dashed border for empty state   |
| `--es-text-primary`   | `#222`    | Summary narrative body text     |
| `--es-text-secondary` | `#666`    | Labels, metadata, hint text     |
| `--es-text-muted`     | `#888`    | Truncation notice               |
| `--es-accent`         | `#0066cc` | Loading spinner top border      |
| `--es-error-border`   | `#e74c3c` | Error state border              |
| `--es-error-bg`       | `#fdf0ef` | Error state background          |
| `--es-error-text`     | `#c0392b` | Error heading and retry border  |
| `--es-header-bg`      | `#f9f9fb` | Success view header background  |

## Typography

- Font: inherited from the host application.
- Heading hierarchy:
  - Email subject: `<h2>`, 1 rem, 600 weight.
  - "Action items" heading: `<h3>`, 0.85 rem, 600 weight.
- Body: inherited size, 1.6 line-height.
- Metadata: 0.8 rem.
- Error heading: 600 weight.
- Truncation notice: 0.8 rem, italic.

## Spacing

- Component padding: 1.25–2 rem.
- Internal gaps between sections: 0.5–1 rem.
- Action item list: `<ul>` with 1.25 rem left padding.

## Interactive elements

- **Retry button**: white background, `--es-error-text` border and text,
  4 px `border-radius`, 0.4 rem / 1 rem padding. Changes cursor to pointer.
- Buttons receive focus outlines via the browser's default `:focus-visible`
  ring.

## Accessibility (visual)

- `aria-label` attributes describe each section's purpose.
- `role="alert"` on the error region for immediate screen-reader
  announcement.
- `aria-busy="true"` on the loading region.
- `aria-live="polite"` on the loading text and success narrative so screen
  readers announce content changes without interrupting.
- Loading spinner is `aria-hidden="true"` because it is decorative.
- Focusable elements (Retry button) receive visible keyboard focus.

## States

| State   | Component             | Visual cue                                    |
| ------- | --------------------- | --------------------------------------------- |
| idle    | `EmailSummaryEmpty`   | Dashed border, centered placeholder message   |
| loading | `EmailSummaryLoading` | CSS spinner animation + "Summarizing email…"  |
| error   | `EmailSummaryError`   | Red border + background, error message, retry |
| ready   | `EmailSummaryView`    | Solid border, header with metadata, body text |
