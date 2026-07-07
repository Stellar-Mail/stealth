# Mail-to-Ticket Converter Data Ownership

## Local Data Model

This tool owns only folder-local, review-oriented data shapes:

- `EmailEvidence`: sanitized evidence summary provided by fixtures or a future
  adapter.
- `TicketDraft`: local title, description, priority, requester, tags, and
  assignee hint.
- `TicketConfidence`: confidence score, missing-field warnings, and review
  requirements.
- `DuplicateTicketHint`: local warning that a draft may match an existing
  ticket summary.
- `TicketReviewState`: local reviewer status such as `new`, `accepted`,
  `deferred`, `rejected`, or `needs-more-evidence`.
- `TicketDraftFilterState`: local filters for team, status, priority, and
  confidence.

These models are internal contracts. They do not imply database ownership,
mailbox ownership, or production ticketing rights.

## Data This Tool Does Not Own

The tool must not own or mutate:

- Live inbox threads, rendered email bodies, attachments, or mailbox metadata.
- User, teammate, department, auth, role, or permission records.
- Wallet, Stellar, payment, or blockchain state.
- Main application database rows or migrations.
- Production ticketing provider records, ticket ids, comments, labels, status
  changes, or audit trails.
- Notification, CRM, analytics, or webhook provider records.

## Source Data Rules

Before integration exists, data should come from local fixtures or inputs
provided by the caller. Fixtures must be synthetic and must not include real
sender, recipient, customer, mailbox, teammate, account, organization, ticket,
or provider data.

After a future integration issue is approved, the main app should prepare and
sanitize evidence before passing it into this tool. This folder should not fetch
or scrape the inbox directly and should not call ticketing providers directly.

## Storage Rules

- Architecture-only work does not persist data.
- Future local prototypes may keep state in memory or local fixtures.
- Production persistence must be handled by a separate integration issue.
- Ticket creation or updates must be a separate issue with explicit review,
  authorization, idempotency, validation, and rollback behavior.

## Dependency Ownership

- `components/` own rendering and local user intent.
- `hooks/` own local state orchestration.
- `services/` own evidence normalization, draft building, scoring, duplicate
  detection, and transition logic.
- `tests/` own local verification.
- `docs/` own contributor guidance and architecture constraints.

No layer owns main-app data access, production persistence, ticket provider
credentials, wallet behavior, or Stellar behavior.

## Future Adapter Contract

A future integration should provide this tool with:

- sanitized email evidence summaries.
- optional ticketing taxonomy metadata.
- reviewer identity already authorized by the main app.
- duplicate ticket summaries that are safe to display.
- callbacks for previewing, creating, or updating tickets.

That adapter should live outside this folder and should be reviewed in its own
issue. This architecture issue only defines the local contract.
