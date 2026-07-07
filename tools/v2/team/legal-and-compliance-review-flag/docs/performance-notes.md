# Legal and Compliance Review Flag Performance Notes

## Local Budgets

The current folder-local guard helper applies these default bounds:

- review body text: 12,000 characters.
- attachment metadata rows: 25 items.
- history rows: 50 items.

These numbers are intentionally conservative for a V2 later-release tool that
does not yet have pagination, virtualization, or backend streaming.

## Large Email Strategy

Future service or UI code should avoid parsing full production email payloads in
render paths. Prefer this sequence:

1. sanitize and truncate text in the service layer.
2. compute review warnings once per input payload.
3. pass bounded, already-normalized data into components.
4. defer attachment body inspection to a separate future issue.
5. add pagination or virtualization before displaying large histories.

## Attachment Strategy

Attachment content should not be read in this tool during the isolated phase.
Only bounded metadata should be accepted. A future integration may add provider
adapters, but those adapters should live outside this folder and pass sanitized
metadata inward.

## Regression Checks

The local test suite validates:

- malformed input returns a controlled error.
- secret-like values are redacted.
- control characters are removed from text fields.
- large bodies, attachment lists, and histories are bounded.
- documentation continues to name the security and performance constraints.
