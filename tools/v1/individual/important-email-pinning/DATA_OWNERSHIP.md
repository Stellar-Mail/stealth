# Important Email Pinning Data Ownership

Important Email Pinning owns only folder-local pin metadata and derived review models. It does not own mailbox records, message bodies, sender identities, labels, read state, account settings, wallet data, Stellar data, or persistence schemas.

## Owned Data

The tool may define and transform these local data shapes:

- `PinRecord`: user-created pin metadata for one message id.
- `PinReason`: short user-provided explanation for why the email is important.
- `PinState`: `pinned`, `unpinned`, `expired`, or `unknown`.
- `PinnedMessageSummary`: a display model composed from a message summary plus local pin metadata.
- `PinAction`: explicit user action to pin, unpin, edit a reason, or clear expiry.

A `PinRecord` should contain only:

- `messageId`;
- `state`;
- `reason`;
- `createdAt`;
- optional `updatedAt`;
- optional `expiresAt`;
- optional `source` identifying whether the action came from a local UI, fixture, or future adapter.

## Borrowed Data

The tool may read normalized message summary fields supplied by tests, fixtures, or a future adapter:

- message id;
- subject or compact title;
- sender display string;
- received timestamp;
- optional importance hints used only for display or review.

The tool must not store or require full message bodies, attachment contents, authentication tokens, mailbox provider ids beyond the supplied `messageId`, or personally sensitive fixture data.

## Derived Data

Derived data is recomputable and should not be treated as authoritative mailbox state:

- active pinned list;
- expired pinned list;
- sorted review sections;
- duplicate detection results;
- accessibility labels for pin state.

If derived data disagrees with host mailbox data in a future integration, the host adapter must reconcile the mismatch outside this folder.

## Persistence Policy

V1 architecture work assumes in-memory or fixture-backed state only. Future persistence must be introduced by a separate issue and must define:

- where pin records are stored;
- whether storage is local-only or synced;
- migration and deletion behavior;
- privacy review for stored reasons;
- export and clear-data behavior.

No database schema, production cache, or mailbox provider metadata may be changed by this isolated architecture contract.

## Data Protection Rules

- Use synthetic fixtures only.
- Keep reasons concise and user-authored.
- Do not send pin metadata to external services by default.
- Do not infer sensitive categories from message content.
- Do not automatically pin based on urgency words or other advisory hints.
