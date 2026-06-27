# Security and Performance Notes

## Threat assumptions

The Email-to-Todo Converter treats every email field as untrusted input, even when
a future integration supplies data from the main mailbox. Attackers may control
subjects, senders, labels, dates, and body text through inbound mail, forwarding,
imports, or copied fixtures.

The isolated V1 tool assumes hostile input can include:

- HTML fragments or script-like content intended to be rendered as markup.
- Control characters, oversized strings, and deeply padded whitespace intended to
  break display or increase processing cost.
- Missing fields or unexpected field types from malformed fixtures or future API
  adapters.
- Invalid timestamps that could create misleading due dates.
- Very large bodies from long threads, quoted histories, or attachment previews.

## Local safety controls

- `validateAndSanitizeEmail` is the boundary helper for incoming payloads. It
  rejects non-object payloads, returns structured errors, and emits warnings for
  lossy cleanup.
- User-controlled text is normalized as plain text: control characters are
  removed, HTML-like tags are stripped, and whitespace is collapsed before task
  draft fields are built.
- Conversion requires at least a sanitized subject or sanitized body. Empty,
  blank, or non-text-only payloads are rejected before a draft is produced.
- Timestamps are allowed to be empty for unknown dates, but malformed supplied
  timestamps are rejected so the tool does not generate due dates from ambiguous
  input.
- The React wrapper displays strings through React text nodes and read-only form
  values only. It does not use raw HTML injection.

## Performance constraints

The converter intentionally avoids full-message or mailbox-wide analysis:

- Body scanning is capped at `MAX_BODY_CHARS_TO_SCAN` characters before priority
  detection and note extraction.
- Subject, sender, labels, and note output have local length limits to prevent
  display blowups and unnecessary work.
- The V1 helper processes a single normalized email at a time. It does not walk
  teams, mailboxes, histories, thread trees, attachments, or remote datasets.
- Attachment content is out of scope. Future attachment support should summarize
  metadata only unless a separate integration issue defines safe extraction and
  file size limits.
- Future batch conversion should page inputs and call the single-email helper per
  item rather than loading whole inboxes or team histories into memory.

## Follow-up integration guidance

A future integration issue should connect this helper at a narrow adapter layer,
keep the validation helper at the mail-to-tool boundary, and add telemetry for
rejected payload counts without logging raw email content.
