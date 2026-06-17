# Email Template Library Review Guide

This tool is intentionally isolated from the main Stealth Mail application. Reviewers can inspect the local component and fixtures without mounting it in production routes.

## Local UI Surface

- `components/EmailTemplateLibrary.tsx` contains the folder-local React surface.
- `fixtures/templates.ts` provides deterministic sample templates and category metadata.
- `index.ts` exports the component and fixtures for a future integration issue.

## States Covered

- Loading: pass `isLoading` to the component. The root sets `aria-busy` and the skeleton area exposes a screen-reader status.
- Error: pass `error` and optionally `onRetry`. The error panel uses `role="alert"` and exposes a keyboard-focusable retry button.
- Empty: pass an empty `templates` array, or filter the fixtures until no results remain. The panel uses `role="status"`.
- Success: using a template shows a visible success panel and updates a polite live region so screen readers announce the action.

## Accessibility Notes

- Search uses a native `<input type="search">` with an explicit label.
- Category filters are native buttons with `aria-pressed`.
- Template cards are native buttons, which keeps pointer, keyboard, and focus behavior consistent.
- Preview content uses a definition list so subject, body, and update metadata remain structured.
- The workflow does not require custom keyboard shortcuts; Tab, Shift+Tab, Enter, and Space cover all controls.

## Visual Style

The component uses neutral Tailwind utility classes and local markup only. It does not modify the shared design system, global CSS, app shell, navigation, authentication, wallet core, Stellar integration, database schema, or mail rendering engine.
