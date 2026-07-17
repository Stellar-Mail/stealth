# Follow-up Reminder

V1 individual tool workspace for creating reviewable follow-up reminders from
email content.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v1/individual/follow-up-reminder/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

## Intended Use

- Inspect normalized email subject, body, sender, and received time.
- Suggest follow-up reminder drafts from explicit requests and dates.
- Let a user confirm, edit, snooze, complete, or dismiss a reminder.
- Keep the tool advisory; it must not send email, create external calendar
  events, change labels, or mark messages read automatically.

## Reminder States

- `draft`: suggested but not confirmed by the user.
- `scheduled`: confirmed reminder with a due time.
- `snoozed`: temporarily delayed by explicit user action.
- `completed`: user marked the follow-up done.
- `dismissed`: user rejected the reminder.

## Testing Focus

Use `docs/test-plan.md` and `docs/fixtures.md` to cover explicit requests,
relative dates, missing dates, snooze/complete/dismiss actions, duplicate
prevention, empty content, accessibility, and non-mutating behavior.
