# Follow-up Reminder

Create reviewable reminder drafts from emails in a V1 individual workspace.

## Scope

- Release tier: V1
- Audience: individual
- Folder ownership: `tools/v1/individual/follow-up-reminder/`

This is a self-contained tooling workspace. Do not wire this tool into the main
app, routing, inbox architecture, wallet core, Stellar core, database,
calendar providers, notification systems, or design system unless a future
integration issue explicitly allows it.

## Internal Structure

- `index.ts` is the only folder-local public API future work should import from.
- `services/` owns pure reminder suggestion logic and synthetic fixtures.
- `components/` owns isolated review UI components.
- `hooks/` is reserved for future local state adapters and must stay free of
  main app stores or router hooks.
- `tests/` owns local unit and component coverage.
- `docs/` owns architecture, engine, style, fixtures, test plan, and handoff
  notes.

## Purpose

Help an individual user remember email follow-ups while keeping reminder
creation explicit, editable, and reversible.

## Functional Contract

- Input: normalized email subject, body, sender display/address, received time,
  and optional timezone.
- Output: one reminder review model.
- The review model should include:
  - `state`
  - `confidence`
  - `title`
  - `dueAt`
  - `sourceMessageId`
  - `signals`
  - `warnings`
- Suggested reminders start as `draft` until the user confirms them.
- If a due date is ambiguous, return a draft with a warning instead of a
  scheduled reminder.
- Duplicate reminders for the same message and due date must be avoided.
- The tool must not send email, create external calendar events, change labels,
  mark messages read, archive, or delete messages.

## Signal Categories

- Explicit request terms such as follow up, remind me, check back, reply by,
  due, deadline, or waiting on response.
- Absolute dates and times.
- Relative dates such as tomorrow, next week, or in two days, resolved with the
  caller-provided timezone.
- Sender and thread hints supplied by the caller.
- Low-confidence contexts such as newsletters, receipts, FYI-only messages, or
  no-action updates.

## Data Ownership And Dependencies

- This folder owns normalized reminder input, synthetic fixtures, suggestion
  signals, review models, warnings, local UI props, and local tests.
- The main inbox, mail renderer, authenticated user/session state, calendar
  provider, notification scheduler, wallet/Stellar state, database, analytics,
  and design-system internals remain outside this folder.
- Future contributors should import through `index.ts` instead of reaching into
  service or component internals.
- Tests must use synthetic senders, message ids, and dates only.

## Required Issue Categories

- Architecture
- Feature
- UI and accessibility
- Security and performance
- Testing and documentation

## UI And Accessibility Expectations

- Reminder title, due time, and state must be visible as text.
- Confirm, snooze, complete, edit, and dismiss controls must be keyboard
  reachable.
- Ambiguous date warnings must be screen-reader reachable.
- Users must be able to edit the due time before scheduling.

## Security And Performance Expectations

- Do not mutate the mailbox in baseline tests.
- Do not send reminder data to external services in baseline tests.
- Do not create external calendar events or send replies automatically.
- Date parsing must be bounded for long messages.
- Fixtures must use synthetic senders, message ids, and dates only.

## Future Contributor Rules

Future contributors may:

- add local services, hooks, components, fixtures, docs, and tests;
- extend reminder signals when deterministic tests and docs cover them;
- add local UI state adapters for idle, loading, draft, warning, and error
  states.

Future contributors may not:

- mount this tool into app routes, dashboard navigation, or inbox panels;
- send, save, schedule, notify, archive, delete, or mark messages read;
- import from inbox, wallet, Stellar, database, authentication, routing, or
  shared design-system internals;
- introduce live network calls, secrets, provider keys, production data, or
  calendar-provider mutations.

## Testing Expectations

See:

- `docs/test-plan.md`
- `docs/fixtures.md`
