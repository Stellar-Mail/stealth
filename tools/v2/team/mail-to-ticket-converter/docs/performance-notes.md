# Mail-to-Ticket Converter Performance Notes

The helper favors predictable bounded work before any future integration with live mail or ticketing systems.

## Bounded Work

- Batch processing is capped with `maxBatchSize`.
- Message body, subject, queue, assignee, and list item strings are capped before matching.
- Recipient, attachment, history, and team-candidate collections are truncated.
- Attachment contents are not read or decoded.

## Large Mail Handling

Future integrations should pass only mail metadata plus a bounded text excerpt into this helper. Large raw MIME payloads, inline attachments, and provider-specific envelope data should stay outside the UI/tool boundary until a dedicated integration issue defines streaming, scanning, and retention rules.

## Team And History Handling

Team candidate lists and ticket histories can grow quickly. Keep ranking and history display work on the capped arrays returned by the guard helper, and fetch deeper history only after a reviewer opens a specific draft.
