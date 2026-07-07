# Mail-to-Ticket Converter Security And Performance Notes

This folder is still isolated from the main app. The guard helper documents and enforces constraints for future mail-to-ticket integration without touching inbox, routing, database, auth, wallet, Stellar, notification, or ticket-provider code.

## Threat Assumptions

- Incoming mail content is untrusted, including subject, body, sender, recipients, attachment metadata, history, and team candidate names.
- Attachment contents are not parsed by this helper. Only metadata is normalized so future integrations can decide whether to fetch or scan files.
- Ticket drafts should not preserve control characters, bidirectional override characters, script tags, or markup delimiters.
- Secret-like text can appear in user mail and should be surfaced as a warning instead of silently promoted into a ticket.
- Large messages, attachment lists, histories, and team candidate lists must be capped before any downstream matching or ticket creation.

## Guarded Inputs

- Sender must be a valid email address.
- Subject and body are required and length-limited.
- Recipients, attachment metadata, history events, and team candidates are truncated to bounded collections.
- Risky attachment extensions and oversized attachments are flagged.
- Script-like content, tracking-pixel hints, and secret-like key/value text are flagged.

## Non-Goals

- No live mail fetching.
- No ticket creation or update.
- No external malware scanning.
- No database writes.
- No main application integration.
