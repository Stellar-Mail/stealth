# Follow-up Reminder Data Ownership Contract

## Owned Data

The isolated tool owns only local, caller-supplied or synthetic data shapes:

- normalized email snapshots passed into the engine.
- reminder review models returned to a future UI.
- signals and warnings derived from bounded local text scans.
- synthetic fixtures used for local tests and review.
- local UI state for loading, empty, error, and review views.

The tool does not own mailbox records, message labels, calendar events,
notification jobs, user accounts, wallet accounts, Stellar transactions,
database rows, provider credentials, or app route state.

## Input Boundary

All caller-provided email data is untrusted. Guards should validate the shape,
sanitize text, cap sizes, and bound existing reminder lists before the engine
runs. The engine scans only bounded text and returns a review model. It does not
store or transmit input data.

Required safe input properties:

- `messageId` is a non-empty synthetic or caller-provided message key.
- `subject` and `body` are bounded strings.
- `senderAddress` is caller-supplied display data, not an identity guarantee.
- `receivedAt` is an ISO timestamp used only for local relative-date resolution.
- `existingReminders` is a bounded list of local duplicate keys.

## Output Boundary

Reminder outputs are advisory:

- `draft` means a user may review and edit a suggestion.
- `no_action` means no reminder should be presented by default.
- `dueAt` can be null when the due date is missing or ambiguous.
- `warnings` explain uncertainty and must be visible in a future UI.

The engine cannot confirm a reminder, create a calendar event, send a
notification, mutate an inbox, change labels, mark messages read, archive,
delete, or reply to email.

## Integration Handoff

A future integration issue must document:

1. which product component supplies normalized email snapshots.
2. where user confirmation is captured.
3. how reminders are persisted after explicit confirmation.
4. which system owns notifications or calendar writes.
5. how duplicate keys are derived across sessions.
6. how user data is protected in logs, analytics, and tests.

Until that handoff exists, this folder remains a self-contained mini-product
with no production side effects.
