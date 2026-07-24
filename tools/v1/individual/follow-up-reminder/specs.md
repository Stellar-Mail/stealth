# Follow-up Reminder

Create reviewable reminder drafts from emails in a V1 individual workspace.

## Scope

- Release tier: V1
- Audience: individual
- Folder ownership: `tools/v1/individual/follow-up-reminder/`

This is a self-contained tooling workspace. Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, or design system unless a future integration issue explicitly allows it.

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

## Testing Expectations

See:

- `docs/test-plan.md`
- `docs/fixtures.md`
