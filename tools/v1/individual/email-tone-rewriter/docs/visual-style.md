# Email Tone Rewriter visual style

This tool uses only folder-local CSS in `styles.css`; it does not alter the shared design system.

- Surface: warm ivory card (`#fffdf8`) with a low-contrast tan border to read as a draft workspace.
- Primary action: purple pill button (`#4c1d95`) with a visible disabled state.
- Focus: every focusable descendant receives a 3px violet `:focus-visible` outline with offset.
- Results: rewritten text is presented in a lavender review panel so it is visually distinct from input.
- Error: soft red background and border while preserving the same layout rhythm.

Accessibility notes:

- Inputs use explicit labels and helper text.
- Tone selection uses a `fieldset`/`legend` radio group for keyboard arrow navigation.
- The draft textarea supports Ctrl+Enter / Command+Enter as an additive shortcut; button activation remains available.
- Loading uses `aria-busy` and `role="status"`; errors use `role="alert"`; success count uses `aria-live="polite"`.
- The rewritten output is focusable (`tabIndex=0`) so keyboard and screen-reader users can move directly to the generated copy.
