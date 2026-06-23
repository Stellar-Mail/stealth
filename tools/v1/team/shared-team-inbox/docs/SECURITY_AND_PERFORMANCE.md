# Shared Team Inbox Security And Performance Notes

## Threat Assumptions

- Sender fields, subjects, previews, comments, reply bodies, attachment metadata, and timestamps are
  untrusted until validated by folder-local guards.
- The shared inbox UI should render derived previews and metadata, not raw message bodies.
- Internal comments are team-only and must not be copied into external reply drafts automatically.
- Delivery proof hashes are references only; this tool must not verify or mutate protocol state.

## Unsafe Inputs

- malformed email-like addresses
- invalid or missing timestamps
- unsupported status values
- oversized subjects, previews, comments, replies, histories, or attachment sets
- control characters in user-visible text
- attachment metadata with missing or negative size values

## Guard Helpers

`services/shared-inbox-guards.mjs` provides:

- message normalization with address, timestamp, status, proof hash, and text guards
- queue building with a configurable batch cap and newest-first sorting
- internal comment draft preparation with team-only visibility
- reply draft preparation with explicit shared inbox sender and recipient validation
- attachment preview deferral for large attachment counts or total byte size

## Performance Constraints

- Default message batches are capped at 500 records before normalization work begins.
- Message bodies are not accepted by the guard surface; callers provide bounded previews.
- Attachment previews are deferred above 10 attachments or 10 MiB of aggregate metadata size.
- Queue sorting happens after validation and should be paged by a future integration adapter for
  histories larger than the local batch limit.

## Integration Notes

Future integration must keep these guards between raw inbox data and UI rendering. Main app routing,
mail rendering, wallet, Stellar core, database, and shared design system code remain out of scope
for this local hardening layer.
