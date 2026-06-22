# Email-to-Todo Converter -- UI and accessibility

This document describes the folder-local user interface for the Email-to-Todo
Converter tool. The UI is isolated to this tool folder and is not mounted into
the main application, routing, navigation, or design system.

## Components

- `ui/EmailToTodoConverter.tsx` -- the primary, self-contained workflow
  component. It renders the selected email, a convert action, and the resulting
  task draft for review.
- `ui/emailToTodoView.ts` -- pure, deterministic view-model helpers used by the
  component (priority detection, due-date suggestion, draft building, status
  messaging). Keeping logic here lets the UI stay thin and testable without a
  DOM.
- `ui/index.ts` -- the local public surface for the tool's UI.

## Workflow and states

The component always reflects one of four explicit states:

- Empty -- no email is selected. The convert action is disabled and guidance is
  shown.
- Loading -- a conversion is in flight. The container sets `aria-busy` and a
  polite status message is announced. Conversion is deterministic today, but the
  loading affordance is kept for the spec's future async extraction option.
- Success -- a task draft is shown for review (title, notes, suggested due date,
  suggested priority). Nothing is saved or synced; user review is preserved.
- Error -- conversion could not run. An alert is shown and focus moves to it.

## Accessibility decisions

- Labeling -- the section is labelled by its heading via `aria-labelledby`, and
  every field uses an explicit `label` bound with `htmlFor`.
- Live regions -- the status line uses `role=status` with `aria-live=polite` so
  state changes are announced without stealing focus. Errors use `role=alert`.
- Focus management -- when a draft appears, focus moves to the draft heading;
  when an error appears, focus moves to the alert. Both targets are
  programmatically focusable but kept out of the normal tab order.
- Keyboard support -- all controls are native `button`, `input`, and `textarea`
  elements, so they are reachable and operable with the keyboard by default.
- Convert button state -- it is disabled when there is no convertible email or
  while a conversion is in flight, and it is described by the status line via
  `aria-describedby`.

## Visual style

Styling is expressed only through local, namespaced class names under the
`email-to-todo-converter` prefix (for example `email-to-todo-converter__title`).
No shared design-system tokens, themes, or global styles are modified. A host
application that later integrates this tool can map these class names to its own
styles. Until an explicit integration issue exists, the component ships without
global styles so it stays isolated.

## Isolation

This UI imports nothing from the main inbox, routing, wallet, Stellar, database,
or design-system layers. It is not registered in any route or navigation
surface, and it is intended to be reviewed as a self-contained mini-product
change.
