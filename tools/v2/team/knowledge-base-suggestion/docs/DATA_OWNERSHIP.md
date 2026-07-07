# Knowledge Base Suggestion Data Ownership

## Local Data Model

This tool owns only folder-local, review-oriented data shapes:

- `SuggestionCandidate`: a proposed article or runbook topic.
- `SuggestionEvidence`: synthetic or injected evidence summary that explains
  why the candidate exists.
- `SuggestionScore`: confidence, recurrence count, risk, and freshness signals.
- `SuggestionReviewState`: local reviewer status such as `new`, `accepted`,
  `deferred`, `rejected`, or `needs-more-evidence`.
- `SuggestionFilterState`: local UI filters for team, topic, confidence, and
  status.

These models are internal contracts. They do not imply database ownership or
production publishing rights.

## Data This Tool Does Not Own

The tool must not own or mutate:

- Live inbox threads, rendered email bodies, attachments, or mailbox metadata.
- User, teammate, department, auth, role, or permission records.
- Wallet, Stellar, payment, or blockchain state.
- Main application database rows or migrations.
- Production knowledge base articles, slugs, publishing workflows, or audit
  trails.
- Notification, ticketing, CRM, or analytics provider records.

## Source Data Rules

Before integration exists, data should come from local fixtures or inputs
provided by the caller. Fixtures must be synthetic and must not include real
sender, recipient, customer, mailbox, teammate, account, or organization data.

After a future integration issue is approved, the main app should prepare and
sanitize evidence before passing it into this tool. This folder should not fetch
or scrape the inbox directly.

## Storage Rules

- Architecture-only work does not persist data.
- Future local prototypes may keep state in memory or local fixtures.
- Production persistence must be handled by a separate integration issue.
- Publishing to a knowledge base must be a separate issue with explicit review,
  authorization, validation, and rollback behavior.

## Dependency Ownership

- `components/` own rendering and local user intent.
- `hooks/` own local state orchestration.
- `services/` own grouping, scoring, normalization, and transition logic.
- `tests/` own local verification.
- `docs/` own contributor guidance and architecture constraints.

No layer owns main-app data access, production persistence, wallet behavior, or
Stellar behavior.

## Future Adapter Contract

A future integration should provide this tool with:

- sanitized evidence summaries.
- optional topic metadata.
- reviewer identity already authorized by the main app.
- callbacks for previewing or publishing suggestions.

That adapter should live outside this folder and should be reviewed in its own
issue. This architecture issue only defines the local contract.
