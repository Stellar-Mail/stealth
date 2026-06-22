# Follow-up Reminder

V1 individual tool workspace for creating reviewable follow-up reminders from
email content.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v1/individual/follow-up-reminder/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet
core, Stellar core, database schema, calendar providers, notification systems,
or existing design system unless a future integration issue explicitly allows
it.

## Contributor Setup

This folder ships local services, components, fixtures, tests, and architecture
notes. Contributors should use these files as the launch contract:

- `index.ts` exposes the folder-local public API.
- `services/followUpReminder.ts` implements the pure reminder suggestion engine.
- `services/fixtures.ts` provides synthetic email fixtures.
- `components/` contains isolated review UI components.
- `docs/architecture.md` defines module boundaries, data ownership, dependency
  rules, and future integration constraints.
- `docs/engine.md` documents inputs, outputs, states, signals, and duplicate
  avoidance.
- `docs/style-guide.md` documents local UI and accessibility conventions.
- `docs/test-plan.md` and `docs/fixtures.md` describe expected test coverage and
  deterministic fixtures.
- `REVIEW_NOTES.md` gives reviewers a quick checklist for this isolated work.

## Intended Use

- Inspect normalized email subject, body, sender, and received time.
- Suggest follow-up reminder drafts from explicit requests and dates.
- Let a user confirm, edit, snooze, complete, or dismiss a reminder in a future
  integration.
- Keep the tool advisory; it must not send email, create external calendar
  events, change labels, or mark messages read automatically.

## Reminder States

- `draft`: suggested but not confirmed by the user.
- `no_action`: no reminder should be suggested by the engine.

Future UI workflows may display scheduled, snoozed, completed, or dismissed
states after a separate integration issue defines persistence and user actions.

## Testing Focus

Use `docs/test-plan.md` and `docs/fixtures.md` to cover explicit requests,
relative dates, missing dates, snooze/complete/dismiss actions, duplicate
prevention, empty content, accessibility, and non-mutating behavior.
