# Calendar Event Extractor Fixtures

Use synthetic senders, attendees, locations, and dates only.

## Absolute Meeting

Input:

```json
{
  "messageId": "msg-201",
  "receivedAt": "2026-06-19T09:00:00Z",
  "timezone": "UTC",
  "subject": "Planning meeting on June 22",
  "from": "team@example.test",
  "body": "Planning meeting: June 22, 2026 at 10:00 UTC in Room 4B."
}
```

Expected:

- State: `draft` or `ready`.
- Title, `startAt`, location, and event-date signals are present.
- No calendar, invite, RSVP, email, or mailbox mutation.

## Relative Date

Input:

```json
{
  "messageId": "msg-202",
  "receivedAt": "2026-06-19T09:00:00Z",
  "timezone": "UTC",
  "subject": "Demo tomorrow",
  "from": "demo@example.test",
  "body": "Let's do the product demo tomorrow at 10:00."
}
```

Expected:

- State: `draft`.
- `startAt` resolves relative to received time and timezone.

## Missing End Time

Input:

```json
{
  "messageId": "msg-203",
  "subject": "Interview slot",
  "from": "recruiting@example.test",
  "body": "Your interview is July 1 at 14:00."
}
```

Expected:

- Event draft includes `startAt`.
- Warning mentions missing end time or duration.

## Conflicting Dates

Input:

```json
{
  "messageId": "msg-204",
  "subject": "Call on Monday",
  "body": "Actually, let's meet Tuesday at 09:00."
}
```

Expected:

- State: `ambiguous`.
- Warning mentions conflicting date signals.

## Duplicate Existing Draft

Input:

```json
{
  "messageId": "msg-205",
  "existingDrafts": [
    {
      "sourceMessageId": "msg-205",
      "startAt": "2026-06-22T10:00:00Z"
    }
  ],
  "body": "Meeting June 22 at 10:00 UTC."
}
```

Expected:

- No duplicate event draft is created.

## Newsletter False Positive

Input:

```json
{
  "messageId": "msg-206",
  "subject": "This week's public events",
  "from": "newsletter@example.test",
  "body": "Public webinar listings for the week. No RSVP required."
}
```

Expected:

- No ready event.
- Newsletter/FYI context lowers confidence.

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

- No event draft or warning-only result.
- No errors.
