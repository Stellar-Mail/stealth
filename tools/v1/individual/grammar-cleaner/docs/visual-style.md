# Grammar Cleaner — Visual Style

This document describes the visual style used by the Grammar Cleaner component
suite. All styles are folder-local inline styles — the shared design system is
not referenced so the tool stays self-contained until a future integration
issue wires it in.

## Layout

- The root container (GrammarCleaner) renders one of four state components:
  empty, loading, error, or success.
- Each state component is a `<section>` or `<article>` with a 1 px border,
  8 px `border-radius`, and padding (1.25–2 rem).
- Max-width is unconstrained so the tool fills whatever container the host app
  provides.

## Colors

| Token                 | Hex       | Usage                              |
| --------------------- | --------- | ---------------------------------- |
| `--gc-border`         | `#e0e0e0` | Default border and loading ring    |
| `--gc-border-dashed`  | `#ccc`    | Dashed border for empty state      |
| `--gc-text-primary`   | `#222`    | Corrected text body                |
| `--gc-text-secondary` | `#666`    | Labels, metadata, hint text        |
| `--gc-text-muted`     | `#888`    | Issue explanation text             |
| `--gc-accent`         | `#0066cc` | Loading spinner top, submit button |
| `--gc-error-border`   | `#e74c3c` | Error state border                 |
| `--gc-error-bg`       | `#fdf0ef` | Error state background             |
| `--gc-error-text`     | `#c0392b` | Error heading and retry border     |
| `--gc-header-bg`      | `#f9f9fb` | Result view header background      |
| `--gc-correct-bg`     | `#f4fdf4` | Corrected text background          |
| `--gc-correct-border` | `#c8e6c9` | Corrected text border              |
| `--gc-issue-bg`       | `#fafafa` | Issue item background              |
| `--gc-spelling`       | `#e67e22` | Spelling issue left border         |
| `--gc-grammar`        | `#8e44ad` | Grammar issue left border          |
| `--gc-punctuation`    | `#2980b9` | Punctuation issue left border      |
| `--gc-capitalization` | `#16a085` | Capitalization issue left border   |
| `--gc-redundancy`     | `#7f8c8d` | Redundancy issue left border       |

## Typography

- Font: inherited from the host application.
- Heading hierarchy:
  - "Grammar Check Results": `<h2>`, 1 rem, 600 weight.
  - Section headings ("Issues", "Corrected Text", "Original Text"): `<h3>`, 0.85 rem, 600 weight.
  - "Text to check" label: 0.85 rem, 500 weight.
- Body: inherited size, 1.6 line-height.
- Issue items: 0.85 rem, with strikethrough on original, bold on suggestion.
- Category badge: 0.7 rem, uppercase, 600 weight.
- Issue explanation: 0.78 rem.
- Metadata / counts: 0.8 rem.

## Spacing

- Component padding: 1.25–2 rem.
- Internal gaps between sections: 0.75–1.25 rem.
- Issue list items: 0.5 rem vertical padding, 0.75 rem horizontal, 0.4 rem gap.
- Button padding: 0.4–0.5 rem / 1–1.25 rem.

## Interactive elements

- **Submit button**: `--gc-accent` background, white text, 4 px `border-radius`,
  disabled at 0.5 opacity with `not-allowed` cursor.
- **Retry button**: white background, `--gc-error-text` border and text,
  4 px `border-radius`.
- **Reset/Check Another button**: white background, `--gc-accent` border and text,
  4 px `border-radius`.
- **Textarea**: 1 px solid `#d0d0d0` border, 4 px `border-radius`, 0.75 rem padding,
  vertical resize, inherits font.
- All interactive elements receive focus outlines via the browser's default
  `:focus-visible` ring.

## Accessibility (visual)

- `aria-label` attributes describe each section's purpose.
- `role="alert"` on the error region for immediate screen-reader announcement.
- `aria-busy="true"` on the loading region.
- `aria-live="polite"` on the loading text and corrected text so screen readers
  announce content changes without interrupting.
- Loading spinner is `aria-hidden="true"` because it is decorative.
- Textarea has a `<label>` with `htmlFor` association and an `aria-label`.
- Submit button is `aria-label="Check grammar"` for screen-reader context.
- Ctrl+Enter / Cmd+Enter keyboard shortcut supported in textarea.
- Focusable elements receive visible keyboard focus.

## States

| State   | Component               | Visual cue                                    |
| ------- | ----------------------- | --------------------------------------------- |
| idle    | `GrammarCleanerEmpty`   | Dashed border, textarea input, submit button  |
| loading | `GrammarCleanerLoading` | CSS spinner animation + "Checking grammar…"   |
| error   | `GrammarCleanerError`   | Red border + background, error message, retry |
| ready   | `GrammarCleanerView`    | Solid border, issues list, corrected/original |
