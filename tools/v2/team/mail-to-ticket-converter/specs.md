# Mail-to-Ticket Converter

The Mail-to-Ticket Converter is a V2 team tool that turns local mail or thread
records into reviewable ticket candidates for support, operations, security,
billing, access, and product queues.

## Scope

- Release tier: V2
- Audience: team
- Folder ownership: `tools/v2/team/mail-to-ticket-converter/`

This is a self-contained tooling workspace. Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, or design system unless a future integration issue explicitly allows it.

## Core Inputs

- `messages`: an array of local mail-like items.
- `isLoading`: optional boolean used by future UI callers to request a loading
  report.
- Each message should include `id`, `subject` or `title`, and optional context
  such as `body`, `senderName`, `senderEmail`, `receivedAt`, `threadId`,
  `labels`, `attachments`, `isVip`, or `requestedBy`.

## Core Outputs

- `state`: `loading`, `empty`, `success`, or `error`.
- `status`: `pending`, `ready`, `converted`, or `blocked`.
- `tickets`: ticket candidates with title, description, category, priority,
  queue, SLA hours, confidence, tags, and source metadata.
- `summary`: counts by category and priority plus highest detected priority.
- `errors`: validation messages for invalid input.

## Conversion Rules

- Critical priority: outage, breach, security incident, data loss, severity 1,
  or production-down language.
- High priority: urgent access failures, VIP requests, billing/payment blockers,
  or time-sensitive customer issues.
- Medium priority: bugs, broken flows, feature requests, customer questions, and
  normal operational requests.
- Low priority: FYI or routine informational messages.
- Queue selection is derived from category first, then urgency signals.

## Non-Goals

- No main app routing, inbox rendering, database writes, ticket-system API calls,
  wallet, Stellar, or design-system changes.
- No production mail, secrets, live network calls, or third-party integrations.
- No automatic ticket creation. The engine only prepares local ticket candidates
  for future human review.
