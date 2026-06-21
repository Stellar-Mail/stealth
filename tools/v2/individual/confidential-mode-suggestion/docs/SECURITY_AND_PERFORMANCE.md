# Safety and Performance Notes

## Scope

These notes apply only to
`tools/v2/individual/confidential-mode-suggestion/`. The tool remains isolated
from app routing, inbox architecture, wallet code, Stellar integration,
database state, live mailboxes, and the shared design system.

## Guard behavior

`services/confidential-mode-guards.mjs` provides a folder-local boundary for
future confidential-mode suggestions. It:

- normalizes subject, body, recipient, attachment, and context input;
- removes control characters and normalizes line endings;
- caps message body, recipient list, and attachment metadata before scoring;
- keeps only attachment metadata and never returns attachment bodies;
- returns deterministic errors for empty requests;
- records whether large input collections were truncated;
- produces a reviewable recommendation with reasons and suggested safeguards.

## Current limits

- Subject: 240 characters.
- Body text: 12,000 characters.
- Recipients: 25 entries, 160 characters each.
- Attachments: 10 metadata entries, 120 characters per name.
- Context notes: 600 characters.

## Unsafe input categories

- Empty messages that do not have a subject or body.
- Very large message bodies.
- Broad recipient lists.
- Attachment objects carrying raw body content.
- Text with control characters or inconsistent newline formats.
- Context notes that are too large to review quickly.

## Review checklist

- Confirm all changed files stay inside the Confidential Mode Suggestion folder.
- Confirm no live mailbox, send, route, wallet, Stellar, database, or network
  integration is added.
- Confirm attachment bodies are not forwarded.
- Confirm large inputs are capped before recommendation scoring.
- Confirm low-signal messages remain review-required instead of being treated as
  automatic privacy decisions.
