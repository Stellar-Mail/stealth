# Priority Detector Fixtures

Use synthetic senders and message content only.

## Urgent Deadline

Input:

```json
{
  "subject": "Action needed today: approve deployment window",
  "from": "ops@example.test",
  "body": "Please approve the deployment window by 17:00 today so the release can proceed."
}
```

Expected:

- Priority: `urgent`.
- Signals include deadline and direct request.
- No inbox mutation.

## High Importance

Input:

```json
{
  "subject": "Review contract notes this week",
  "from": "legal@example.test",
  "body": "Could you review these contract notes before Friday?"
}
```

Expected:

- Priority: `high`.
- Explanation mentions review request and later deadline.

## Normal Update

Input:

```json
{
  "subject": "Project status update",
  "from": "teammate@example.test",
  "body": "The project is on track. No action needed right now."
}
```

Expected:

- Priority: `normal`.
- Signals mention informational update.

## Newsletter With Urgency Copy

Input:

```json
{
  "subject": "Last chance to read this weekly digest",
  "from": "newsletter@example.test",
  "body": "Weekly digest with unsubscribe footer and promotional summaries."
}
```

Expected:

- Priority: `low`.
- Promotional urgency should not create an urgent label.

## Conflicting Signals

Input:

```json
{
  "subject": "URGENT: FYI only",
  "from": "updates@example.test",
  "body": "Sharing this for awareness. No response is required."
}
```

Expected:

- Priority: `unknown` or low-confidence `normal`.
- Warning notes conflicting subject/body signals.

## Security Alert

Input:

```json
{
  "subject": "Security review requested for account access",
  "from": "security@example.test",
  "body": "Please review the attached account access change request today."
}
```

Expected:

- Priority: `urgent` or `high`.
- Security and review-request signals are present.
- No automatic link-click or reply recommendation.

## Empty Content

Input:

```json
{
  "subject": "",
  "from": "unknown@example.test",
  "body": ""
}
```

Expected:

- Priority: `unknown`.
- Warning: insufficient content.
