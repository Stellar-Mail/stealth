# Follow-up Reminder -- core feature engine

This document describes the folder-local core engine for the Follow-up Reminder
tool. The engine is self-contained and is not wired into the main app, routing,
inbox, wallet, Stellar core, database, or design system.

## What the engine does

`buildFollowUpReminder(input, options?)` turns one normalized email into a
single reminder review model. It is the only behavior a future UI needs to call.
The engine is pure and deterministic: the same input always yields the same
output.

## Inputs

`NormalizedEmailInput`:

- `messageId` -- synthetic source message id.
- `subject` and `body` -- email text.
- `senderAddress`, optional `senderName`.
- `receivedAt` -- ISO-8601 timestamp, used as the base for relative dates.
- optional `timeZone` -- IANA timezone for relative-date confirmation.
- optional `threadHint` -- caller-supplied sender or thread hint.

`BuildReminderOptions`:

- `now` -- optional base timestamp override for relative-date resolution.
- `existingReminders` -- known reminder keys, used to avoid duplicates.

## Output

`ReminderReviewModel` with `state`, `confidence`, `title`, `dueAt`,
`sourceMessageId`, `signals`, and `warnings`.

- `state` is `draft` for a suggested reminder, or `no_action` when nothing should
  be suggested. Suggested reminders always start as `draft` until a user
  confirms them; the engine never schedules or confirms.
- `confidence` is `high`, `medium`, or `low`.
- `dueAt` is an ISO date or datetime, or `null` when no clear date is available.

## States, loading, and errors

- The engine is synchronous and performs no IO, so it has no async loading state
  of its own. A host UI owns any loading indicator while it gathers email input.
- Errors are surfaced as data, not exceptions. Malformed or missing dates,
  ambiguous dates, low-confidence contexts, and missing signals produce
  `warnings` and a safe `no_action` or null `dueAt` result instead of throwing.
- Ambiguous due dates always return a `draft` with a warning rather than a
  scheduled reminder.

## Signals

- Explicit request terms (for example follow up, remind me, reply by, deadline).
- Absolute dates and datetimes in ISO form (YYYY-MM-DD and YYYY-MM-DDTHH:mm).
- Relative dates: tomorrow, next week, and in N days (digits or one through
  ten), resolved from the base timestamp.
- Sender or thread hints supplied by the caller.
- Low-confidence contexts such as newsletters, receipts, and FYI-only messages.

## Duplicate avoidance

When `options.existingReminders` already contains the same `sourceMessageId` and
`dueAt`, the engine returns `no_action` with a warning so duplicate reminders are
not suggested.

## Security and performance

- No network calls, secrets, or production data are used.
- The engine never sends email, creates calendar events, changes labels, marks
  messages read, archives, or deletes messages.
- Date and keyword scanning is bounded to the first 4000 characters so long
  messages stay fast.
- Fixtures use synthetic senders, message ids, and dates only.

## API surface

The tool's public surface is exported from `index.ts`: `buildFollowUpReminder`,
`isReminderDuplicate`, `summarizeReminder`, the related types, and the synthetic
`sampleEmails` fixtures.
