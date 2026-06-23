# Security and Performance Notes

## Threat Assumptions

Every email field is untrusted. The converter must assume hostile senders can
control subject lines, body text, attachment names, MIME types, thread content,
and timestamps. Future integrations should keep raw mail out of logs and avoid
feeding unsanitized content into HTML, markdown, shell commands, or remote APIs.

Unsafe inputs include:

- HTML and script-like content in subject or body fields,
- control characters and path traversal strings in attachment names,
- pasted passwords, API keys, bearer tokens, or reset links,
- oversized bodies, attachment lists, or thread histories,
- malformed envelope data such as missing IDs or invalid sender addresses.

## Current Guardrails

`guards.mjs` adds a folder-local normalization layer:

- `validateMailEnvelope()` returns reviewable errors for malformed objects.
- `sanitizeText()` strips script/style blocks, HTML tags, and control characters.
- Secret-like assignments and bearer tokens are redacted before ticket text is generated.
- `evaluateProcessingBudget()` computes size pressure before expensive processing.
- `normalizeTicketCandidate()` caps body, attachment, and thread previews.

The helpers do not fetch attachments, call external services, read production
mailboxes, or persist ticket data. They only normalize objects passed by future
callers.

## Performance Constraints

The default processing limits are intentionally conservative:

- subject: 160 characters,
- body preview: 12,000 characters,
- attachments: 8 entries,
- single attachment size: 10 MiB,
- total attachment size: 25 MiB,
- thread preview: 50 items.

Large attachments are marked `skipped`; callers should process them through a
separate, explicit attachment pipeline instead of inline conversion. Long
threads are summarized by preview only so future UI work can remain responsive.

## Follow-Up Integration Guidance

Before this tool is connected to the mail app, add an integration issue for:

- permission checks on who can convert team mail into tickets,
- audit logging with redacted ticket payloads,
- attachment malware scanning or explicit attachment exclusion,
- backpressure when multiple team members convert the same mailbox,
- UI review states for warnings such as `large-attachment-skipped`.
