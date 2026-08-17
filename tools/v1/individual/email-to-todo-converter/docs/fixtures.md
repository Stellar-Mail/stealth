# Email-to-Todo Converter Fixtures

Use these fixture shapes when executable tests are added. They are intentionally
plain JSON-like records so the future implementation can adapt them to its test
runner without pulling in app-level inbox code.

## Fixture: Direct Request

```json
{
  "id": "email-direct-request",
  "subject": "Please review the invoice by Friday",
  "sender": "billing@example.com",
  "receivedAt": "2026-06-19T09:00:00Z",
  "bodyText": "Please review the attached invoice by Friday and let me know if anything is missing.",
  "labels": ["inbox"]
}
```

Expected task draft:

- title: `Review the invoice`
- dueDate: next Friday relative to `receivedAt`
- priority: `normal`
- sourceEmailId: `email-direct-request`

## Fixture: Urgent Follow-Up

```json
{
  "id": "email-urgent-follow-up",
  "subject": "Urgent: follow up with partner",
  "sender": "ops@example.com",
  "receivedAt": "2026-06-19T10:30:00Z",
  "bodyText": "Can you follow up with the partner today? This is blocking the launch checklist.",
  "labels": ["important"]
}
```

Expected task draft:

- title: `Follow up with the partner`
- dueDate: same calendar day as `receivedAt`
- priority: `high`
- sourceEmailId: `email-urgent-follow-up`

## Fixture: No Action

```json
{
  "id": "email-newsletter",
  "subject": "Weekly product updates",
  "sender": "newsletter@example.com",
  "receivedAt": "2026-06-19T11:00:00Z",
  "bodyText": "Here are this week's product updates and release notes.",
  "labels": ["newsletter"]
}
```

Expected outcome:

- no task draft is created;
- the UI explains that no clear action was detected.
