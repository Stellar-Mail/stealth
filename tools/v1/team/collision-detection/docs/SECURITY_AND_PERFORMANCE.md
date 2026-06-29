# Security And Performance Notes

## Threat Assumptions

The collision-detection tool will eventually receive candidate responses from a
shared team mailbox or queue. Until integration exists, this folder treats all
candidate data as untrusted input:

- sender names, recipients, subjects, and bodies may contain HTML, script tags,
  control characters, misleading whitespace, or oversized text.
- attachment metadata may be missing, malformed, negative, or inflated.
- histories may contain thousands of old candidate responses.
- candidates may be partial objects from failed imports or stale clients.

The guard layer must normalize and bound this data before any future collision
algorithm, UI, or persistence layer consumes it.

## Unsafe Inputs

`prepareCollisionInput` rejects a non-array top-level payload because collision
analysis depends on iterating a candidate list. Individual malformed candidates
inside a valid list are skipped with warnings instead of throwing.

Text fields are sanitized by:

- coercing primitive values to text and dropping object/function payloads.
- removing control characters.
- stripping HTML-like tags.
- collapsing repeated whitespace.
- truncating long bodies and subjects to configured limits.

Attachment processing is bounded by:

- `maxAttachmentCount` to avoid scanning arbitrary attachment lists.
- `maxAttachmentBytes` to stop aggregate size accounting once a candidate would
  exceed the configured byte budget.

## Performance Notes

Large team histories are bounded with `maxItems`. The implementation slices the
candidate list before reading candidate properties, so entries beyond the limit
are not inspected. This matters for imported histories with expensive getters,
large nested metadata, or stale objects from browser storage.

Recommended default budgets:

| Budget            |     Default | Reason                                                  |
| ----------------- | ----------: | ------------------------------------------------------- |
| Candidate history |   250 items | Keeps V1 review responsive for shared queues.           |
| Subject text      |   240 chars | Enough for comparison without indexing large blobs.     |
| Body text         | 8,000 chars | Covers normal replies while avoiding long email chains. |
| Attachments       |    25 items | Avoids unbounded metadata scans.                        |
| Attachment bytes  |       50 MB | Matches a conservative review budget for team mail.     |

Future integration should run the guard before any duplicate-response UI, team
state update, storage write, or network call.
