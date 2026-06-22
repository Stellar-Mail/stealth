# Schedule Send

V1 individual tool workspace for preparing and reviewing future email delivery
requests before they are handed to any mail-sending integration.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v1/individual/schedule-send/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

## Intended Use

- Capture a draft message, recipient set, and scheduled send time.
- Normalize local dates and times into a reviewable scheduled timestamp.
- Show timezone, recurrence, cancellation, and edit state clearly.
- Require explicit user confirmation before any future integration sends or
  queues an email.

## Non-Goals

- Do not send email from this isolated workspace.
- Do not modify Gmail, SMTP, queue, routing, or inbox behavior.
- Do not store passwords, OAuth tokens, or account credentials.

## Testing Focus

Use `docs/test-plan.md` and `docs/fixtures.md` to validate timezone handling,
past-time rejection, daylight-saving boundaries, recipient review, cancellation,
and confirmation-before-mutation behavior.
