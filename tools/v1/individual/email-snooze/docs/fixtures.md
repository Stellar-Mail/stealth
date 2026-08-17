# Email Snooze Fixtures

Use these fixture shapes when executable tests are added. They are intentionally
plain JSON-like records so the future implementation can adapt them to its test
runner without importing app-level inbox code.

## Fixture: Tomorrow Morning

```json
{
  "email": {
    "id": "email-snooze-tomorrow",
    "subject": "Quarterly budget follow-up",
    "sender": "finance@example.com",
    "receivedAt": "2026-06-19T09:00:00Z"
  },
  "request": "tomorrow morning",
  "clock": "2026-06-19T10:00:00Z",
  "timezone": "Asia/Shanghai"
}
```

Expected snooze draft:

- sourceEmailId: `email-snooze-tomorrow`
- wakeTime: next morning relative to the fixed clock and timezone
- mutatesMailboxBeforeConfirm: `false`

## Fixture: Explicit ISO Time

```json
{
  "email": {
    "id": "email-snooze-iso",
    "subject": "Contract review",
    "sender": "legal@example.com",
    "receivedAt": "2026-06-19T11:30:00Z"
  },
  "request": "2026-06-22T01:00:00Z",
  "clock": "2026-06-19T12:00:00Z",
  "timezone": "UTC"
}
```

Expected snooze draft:

- sourceEmailId: `email-snooze-iso`
- wakeTime: `2026-06-22T01:00:00Z`
- timezone: `UTC`

## Fixture: Past Time

```json
{
  "email": {
    "id": "email-snooze-past",
    "subject": "Already late",
    "sender": "ops@example.com",
    "receivedAt": "2026-06-19T08:00:00Z"
  },
  "request": "2026-06-18T08:00:00Z",
  "clock": "2026-06-19T12:00:00Z",
  "timezone": "UTC"
}
```

Expected outcome:

- no snooze draft is created;
- validation explains that the wake time must be in the future.
