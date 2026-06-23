# SLA Deadline Tracker Service Contract

## Inputs

The core service accepts synthetic or sanitized deadline records with:

- `id`: local deadline record ID
- `messageId`: reference to the source message, not the message body
- `sharedInboxId`: shared inbox identifier
- `subject`: display subject for future UI work
- `receivedAt`: ISO timestamp used to compute the deadline
- `resolvedAt`: optional ISO timestamp that marks the record resolved
- `policy`: `{ name, targetMinutes, dueSoonWindowMinutes }`
- `assignee`: optional synthetic team member identifier
- `escalationNote`: optional local note for future escalation workflows

## Outputs

`evaluateDeadlineState` returns the normalized input plus:

- `dueAt`: computed ISO timestamp
- `state`: `ok`, `due-soon`, `breached`, or `resolved`
- `minutesUntilDue`: integer minutes until breach, or `null` for resolved records
- `isActionable`: true for `due-soon` and `breached` records

`buildDeadlineQueue` returns records sorted by soonest due time, keeping resolved records last.
`filterDeadlineQueue` filters by state, assignee, or shared inbox.
`summarizeDeadlineQueue` returns total, state counts, and actionable count.

## Loading and Error States

The service is synchronous and pure. Future UI hooks should represent these states:

- `loading`: caller is fetching sanitized records from a future integration adapter
- `ready`: records were normalized and evaluated successfully
- `empty`: no records were supplied
- `error`: validation failed with `SlaDeadlineValidationError`

Validation errors include a message and optional `details` object. The service does not retry,
fetch, persist, or schedule background work.

## Safety and Performance

- No live network calls, production data, secrets, payment data, or mailbox credentials are used.
- Batch size defaults to 500 records to prevent accidental large-history work.
- Date calculation uses deterministic `now` injection in tests and future callers.
- Fixtures use `.test` domains and synthetic IDs only.
