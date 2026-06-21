# Email Translator UI and Accessibility Notes

## Scope

This note covers the folder-local UI surface for the Email Translator tool. The
panel is not mounted in the main app and does not call a live translation
service.

## States

- Empty: prompts the user to paste an email before translation.
- Loading: disables the submit button and announces that a preview is being prepared.
- Error: uses `role="alert"` for missing text, same-language selection, and local size-limit failures.
- Success: announces a completed preview and exposes the result in a focusable region.

## Keyboard and Screen Reader Behavior

- Native form controls are used for language selection, text entry, and the tone toggle.
- The email textarea references both the size hint and status region with `aria-describedby`.
- Status copy is announced through a single live region.
- The output article is focusable so keyboard users can move directly to the generated preview.
- Buttons keep their visible labels aligned with their state and do not rely on icon-only controls.

## Review Notes

- The component intentionally uses deterministic placeholder preview text instead of a network request.
- Large emails are capped at 12,000 characters for the local preview surface.
- Main app routes, inbox architecture, wallet code, Stellar integrations, database schema, and shared design-system files are untouched.
