# Grammar Cleaner UI and Accessibility Notes

## Scope

This note covers the folder-local UI surface for the Grammar Cleaner tool. The
panel is not mounted in the main app and does not call a live grammar service.

## States

- Empty: prompts the user to paste a draft before running cleanup.
- Loading: disables the submit button and announces that a preview is being prepared.
- Error: uses `role="alert"` for missing text and local size-limit failures.
- Success: announces a completed preview and exposes the result in a focusable region.

## Keyboard and Screen Reader Behavior

- Native form controls are used for the draft textarea, cleanup-level select,
  tone-preservation checkbox, and action buttons.
- The draft textarea references both the size hint and status region with
  `aria-describedby`.
- Status copy is announced through a single live region.
- The cleaned preview article is focusable so keyboard users can move directly
  to the generated result.
- Buttons keep visible labels aligned with their current state and do not rely
  on icon-only controls.

## Visual Style Notes

- The component uses local class names prefixed with `grammar-cleaner-panel__`
  so future styling can remain isolated to this tool folder.
- The intended layout is a simple two-part workflow: draft input and controls
  first, then status and preview output.
- Empty and error states should remain visibly distinct from the success state,
  but the shared design system is intentionally untouched in this issue.

## Review Notes

- The component intentionally uses deterministic placeholder preview text
  instead of a network request.
- Drafts are capped at 10,000 characters for the local review surface.
- Main app routes, inbox architecture, wallet code, Stellar integrations,
  database schema, and shared design-system files are untouched.
