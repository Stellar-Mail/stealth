# Schedule Send Fixtures

Use synthetic recipients and draft IDs only.

## Future One-Time Schedule

Input:

```json
{
  "draftId": "draft_test_001",
  "recipients": {
    "to": ["alex@example.test"],
    "cc": [],
    "bcc": []
  },
  "subject": "Project update",
  "scheduledLocalTime": "2026-06-20T09:30:00",
  "timezone": "Pacific/Auckland"
}
```

Expected:

- Status: `ready-for-confirmation`.
- UTC timestamp is present.
- Timezone is visible in review output.

## Past Time

Input:

```json
{
  "draftId": "draft_test_002",
  "recipients": {
    "to": ["alex@example.test"],
    "cc": [],
    "bcc": []
  },
  "subject": "Late update",
  "scheduledLocalTime": "2020-01-01T09:30:00",
  "timezone": "Pacific/Auckland"
}
```

Expected:

- Blocking warning for past scheduled time.
- No queue or send action.

## Missing Recipients

Input:

```json
{
  "draftId": "draft_test_003",
  "recipients": {
    "to": [],
    "cc": [],
    "bcc": []
  },
  "subject": "No recipient",
  "scheduledLocalTime": "2026-06-20T09:30:00",
  "timezone": "UTC"
}
```

Expected:

- Blocking warning for missing recipients.
- Status remains `draft` or invalid.

## Multiple Recipient Groups

Input:

```json
{
  "draftId": "draft_test_004",
  "recipients": {
    "to": ["primary@example.test"],
    "cc": ["copy@example.test"],
    "bcc": ["hidden@example.test"]
  },
  "subject": "Recipient review",
  "scheduledLocalTime": "2026-06-20T15:00:00",
  "timezone": "Asia/Shanghai"
}
```

Expected:

- Recipient count is three.
- To, cc, and bcc groups remain distinguishable before confirmation.

## Cancellation

Input:

```json
{
  "draftId": "draft_test_005",
  "status": "scheduled",
  "scheduledUtc": "2026-06-20T01:30:00Z",
  "cancelRequested": true
}
```

Expected:

- Status becomes `cancelled`.
- No send behavior occurs during cancellation.

## Daylight-Saving Ambiguity

Input:

```json
{
  "draftId": "draft_test_006",
  "recipients": {
    "to": ["dst@example.test"],
    "cc": [],
    "bcc": []
  },
  "subject": "DST check",
  "scheduledLocalTime": "2026-11-01T01:30:00",
  "timezone": "America/New_York"
}
```

Expected:

- Ambiguous-time warning.
- Manual review required before confirmation.
