# Email Ownership Tracker Security And Performance Notes

## Threat Assumptions

- Ownership events can arrive from UI actions, future inbox adapters, or replayed local fixtures and
  must be treated as untrusted until normalized.
- Message subjects, notes, actor addresses, owner addresses, timestamps, and actions are unsafe
  inputs.
- The tracker stores derived ownership metadata only. It must not store full message bodies,
  credentials, delivery proofs, private mailbox data, or payment details.

## Guard Surface

`services/ownership-guards.mjs` provides folder-local guards for:

- stripping control characters from user-visible text
- validating email-like actor, owner, previous owner, and shared inbox addresses
- validating ISO timestamps before timeline sorting
- rejecting unsupported ownership actions
- requiring owners for claim and reassignment events
- requiring previous owners for reassignment events
- capping batch size before normalization work starts
- building chronological timelines and current ownership summaries

## Unsafe Inputs

- malformed addresses
- unsupported actions such as `archive`, `delete`, or arbitrary workflow names
- invalid timestamps or future adapter placeholders
- ownership assignment events without an owner
- reassignment events without a previous owner
- oversized subjects, notes, message IDs, or event batches
- control characters in subjects or notes

## Performance Constraints

- Event batches default to a 1,000-event cap before normalization and sorting.
- Summaries are computed with one pass over the normalized timeline.
- The guard layer does not fetch mail, inspect attachments, start timers, or write durable storage.
- Future integration should page large histories before passing data into these helpers.

## Integration Boundary

These guards are safe to use before any future UI or service integration. They do not import from
the main app shell, routing, inbox architecture, wallet core, Stellar core, database, or shared
design system.
