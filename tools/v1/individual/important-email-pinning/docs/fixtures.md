# Important Email Pinning Fixtures

Use synthetic messages and senders only.

## Manual Pin

Input:

```json
{
  "messages": [
    {
      "messageId": "msg-001",
      "subject": "Contract review due Friday",
      "from": "legal@example.test"
    }
  ],
  "action": {
    "type": "pin",
    "messageId": "msg-001",
    "reason": "Review before Friday"
  }
}
```

Expected:

- One active `pinned` record for `msg-001`.
- Reason is preserved.
- No mailbox mutation.

## Duplicate Pin

Input:

```json
{
  "pins": [
    {
      "messageId": "msg-002",
      "state": "pinned",
      "reason": "Travel check-in"
    }
  ],
  "action": {
    "type": "pin",
    "messageId": "msg-002",
    "reason": "Travel check-in"
  }
}
```

Expected:

- Exactly one active pin remains for `msg-002`.
- Duplicate action does not create another active record.

## Expired Pin

Input:

```json
{
  "now": "2026-06-19T09:00:00Z",
  "pins": [
    {
      "messageId": "msg-003",
      "state": "pinned",
      "reason": "Renewal deadline",
      "expiresAt": "2026-06-18T09:00:00Z"
    }
  ]
}
```

Expected:

- Pin is marked `expired` or omitted from active view by explicit filter.
- Expired state is visible as text.

## Advisory Urgent Message

Input:

```json
{
  "messages": [
    {
      "messageId": "msg-004",
      "subject": "URGENT: weekly digest",
      "from": "newsletter@example.test"
    }
  ],
  "action": null
}
```

Expected:

- No automatic pin is created.
- Urgent-looking text remains advisory only.

## Empty Input

Input:

```json
{
  "messages": [],
  "pins": []
}
```

Expected:

- Empty pinned result.
- No errors or placeholder pins.
