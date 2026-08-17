# Email Summarizer Fixtures

Use these fixture shapes when executable tests are added. They are intentionally
plain JSON-like records so the future implementation can adapt them to its test
runner without importing app-level inbox code.

## Fixture: Project Update With Actions

```json
{
  "id": "email-project-update",
  "subject": "Project launch update and next steps",
  "sender": "lead@example.com",
  "receivedAt": "2026-06-19T09:00:00Z",
  "bodyText": "The launch checklist is mostly complete. The payment copy still needs review, analytics tracking needs a final smoke test, and the release notes need one more pass before Monday. Please confirm the owner for each item today.",
  "maxSentences": 2
}
```

Expected summary:

- mentions that launch prep is mostly complete;
- mentions remaining review, smoke-test, and release-notes work;
- actionItems includes confirming owners today.

## Fixture: Informational Newsletter

```json
{
  "id": "email-newsletter-summary",
  "subject": "Weekly product updates",
  "sender": "newsletter@example.com",
  "receivedAt": "2026-06-19T11:00:00Z",
  "bodyText": "This week we shipped search improvements, updated the dashboard layout, and fixed several accessibility bugs. No action is required.",
  "maxSentences": 1
}
```

Expected summary:

- mentions shipped search, dashboard, and accessibility updates;
- actionItems is empty.

## Fixture: Empty Body

```json
{
  "id": "email-empty-summary",
  "subject": "Missing content",
  "sender": "sender@example.com",
  "receivedAt": "2026-06-19T12:00:00Z",
  "bodyText": "",
  "maxSentences": 2
}
```

Expected outcome:

- no summary is created;
- validation explains that email body text is required.
