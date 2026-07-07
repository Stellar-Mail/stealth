# Legal and Compliance Review Flag Security and Performance Notes

## Threat Assumptions

Inputs for this isolated tool may eventually come from email bodies, attachment
metadata, reviewer notes, or imported history. Until a future integration issue
defines the live data path, every caller-provided value should be treated as
untrusted.

The tool must defend against:

- malformed payloads such as null, arrays, or primitive values.
- hostile control characters in subject lines, body text, attachment names, or
  history fields.
- accidental secret exposure in review text, including token, password, secret,
  private key, or API key assignments.
- large email bodies that could slow review rendering.
- large attachment lists or long audit histories that could create unnecessary
  work before pagination exists.
- production data leakage through fixtures or test snapshots.

## Guard Helper

`services/review-safety-guards.mjs` provides zero-dependency helpers for this
folder:

- `sanitizeReviewText` removes unsafe control characters, redacts secret-like
  assignments, and truncates oversized text.
- `normalizeAttachmentList` keeps attachment metadata synthetic and bounded.
- `normalizeHistoryItems` keeps history entries bounded.
- `evaluateLegalReviewInput` validates a full review payload and reports errors,
  warnings, sanitized output, and performance counters.

These helpers are intentionally local and do not import the main app, inbox,
database, wallet, Stellar, auth, or design-system code.

## Required Handling

- Invalid payloads should return `input-must-be-object` instead of throwing.
- Empty required fields should report `subject-required` or `body-required`.
- Secret-like assignments should be redacted before rendering or snapshotting.
- Oversized body text should be truncated and flagged with `body-truncated`.
- Oversized attachment and history arrays should be bounded before any future
  UI work renders them.

## Out of Scope

This contribution does not add:

- live inbox reads, mailbox writes, or mail rendering changes.
- database schema changes or persistence.
- notification delivery or reviewer assignment writes.
- auth, wallet, Stellar, or payment behavior.
- external legal, compliance, ticketing, or storage provider calls.
- app shell, routing, dashboard, or shared design-system integration.
