# Follow-up Reminder Fixtures

Use synthetic senders, message ids, and dates only.

## Explicit Follow-up Request

Input:

```json
{
  "messageId": "msg-101",
  "receivedAt": "2026-06-19T09:00:00Z",
  "timezone": "UTC",
  "subject": "Contract notes",
  "from": "legal@example.test",
  "body": "Please follow up with comments by Friday at 17:00."
}
```

Expected:

- State: `draft`.
- Signals include follow-up request and due time.
- No email, calendar, label, read-state, archive, or delete mutation.

## Relative Date

Input:

```json
{
  "messageId": "msg-102",
  "receivedAt": "2026-06-19T09:00:00Z",
  "timezone": "UTC",
  "subject": "Check back",
  "from": "ops@example.test",
  "body": "Can you remind me to check back tomorrow morning?"
}
```

Expected:

- State: `draft`.
- Due time is resolved relative to the received time and timezone.

## Ambiguous Date

Input:

```json
{
  "messageId": "msg-103",
  "subject": "Need this soon",
  "from": "teammate@example.test",
  "body": "Please follow up soon when you have time."
}
```

Expected:

- State: `draft` or no scheduled reminder.
- Warning mentions ambiguous due time.

## Duplicate Existing Reminder

Input:

```json
{
  "messageId": "msg-104",
  "existingReminders": [
    {
      "sourceMessageId": "msg-104",
      "state": "scheduled",
      "dueAt": "2026-06-20T09:00:00Z"
    }
  ],
  "action": {
    "type": "schedule",
    "dueAt": "2026-06-20T09:00:00Z"
  }
}
```

Expected:

- No duplicate reminder is created.
- Existing scheduled reminder remains stable.

## FYI False Positive

Input:

```json
{
  "messageId": "msg-105",
  "subject": "Weekly FYI digest",
  "from": "digest@example.test",
  "body": "FYI only. No response is needed."
}
```

Expected:

- No scheduled reminder.
- FYI/no-action signal prevents high-confidence follow-up.

## Empty Content

Input:

```json
{
  "messageId": "msg-empty",
  "subject": "",
  "body": ""
}
```

Expected:

- No reminder or warning-only result.
- No errors.
