# Security and performance notes

## Threat assumptions

The converter may eventually receive user-controlled mail content from external senders, team inboxes, forwarded threads, or pasted examples. Treat every field as hostile until validated inside this folder.

Primary risks handled by the local guard:

1. **Header injection** — newline-delimited `To:`, `Cc:`, `Bcc:`, `From:`, `Reply-To:`, or `Subject:` fragments are rejected before ticket generation.
2. **Active markup** — script-like tags are replaced with inert text before summaries or previews render them.
3. **Control characters** — invisible control bytes are stripped to avoid parser and reviewer confusion.
4. **Path-like attachments** — slash and backslash characters in attachment names are normalized so future file handling cannot accidentally treat names as paths.
5. **Oversized input** — subject, body, recipient, and attachment limits bound synchronous work and keep future UI previews responsive.

## Performance posture

`MailToTicketSecurityGuard.estimateProcessingCost()` assigns a simple deterministic cost from body length, recipient count, and attachment count. `shouldDefer()` returns true when the conversion should be queued or chunked instead of handled in an immediate UI path.

Future integration should keep these rules:

- Run the guard before any model, parser, or ticket API call.
- Defer high-cost conversions to a worker with progress state rather than blocking the page.
- Preserve `warnings` on the ticket draft so reviewers know what was normalized or truncated.
- Do not fetch remote attachments, remote images, or linked resources from this isolated tool without a separate issue and sandbox policy.

## Non-goals

This folder does not implement production mail ingestion, ticket persistence, authentication, authorization, webhook delivery, or app routing. Those remain out of scope until an explicit integration issue links this tool to the main application.
