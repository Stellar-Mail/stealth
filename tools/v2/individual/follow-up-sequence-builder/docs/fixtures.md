# Follow-up Sequence Builder Fixtures

Use synthetic senders, message ids, and dates only.

## Urgent Request With Deadline

Input:

```json
{
  "messageId": "msg-2001",
  "subject": "URGENT: Contract approval needed by 2026-08-01",
  "body": "Please follow up on this asap. We need the signed contract by 2026-08-01.",
  "senderName": "Alice Executive",
  "senderAddress": "alice@corp.example",
  "receivedAt": "2026-07-20T09:00:00.000Z",
  "timeZone": "America/New_York"
}
```

Expected:

- Confidence: `high`, Urgency: `critical`.
- 3 steps: 1 day, 3 days, 7 days.
- No warnings.

## Normal Follow-Up Request

Input:

```json
{
  "messageId": "msg-2002",
  "subject": "Proposal review",
  "body": "Let me know your thoughts on the proposal when you get a chance. Would like to circle back on this soon.",
  "senderName": "Bob Manager",
  "senderAddress": "bob@team.example",
  "receivedAt": "2026-07-19T14:00:00.000Z",
  "timeZone": "America/New_York"
}
```

Expected:

- Confidence: `medium`, Urgency: `normal`.
- 3 steps: 3 days, 7 days, 14 days.
- No explicit request warning (has "circle back", no "follow up").

## Low-Priority FYI

Input:

```json
{
  "messageId": "msg-2003",
  "subject": "FYI: Quarterly report",
  "body": "Just sharing the quarterly report. No rush, FYI only.",
  "senderName": "Carol Analyst",
  "senderAddress": "carol@reports.example",
  "receivedAt": "2026-07-18T10:00:00.000Z"
}
```

Expected:

- Confidence: `low`.
- Empty steps array.
- Low-priority context warning.

## No Actionable Signal

Input:

```json
{
  "messageId": "msg-2004",
  "subject": "Lunch this weekend",
  "body": "Are you free for lunch this Saturday? Let me know.",
  "senderName": "Dave Friend",
  "senderAddress": "dave@personal.example",
  "receivedAt": "2026-07-17T08:00:00.000Z"
}
```

Expected:

- Confidence: `low`.
- Empty steps array.
- No actionable signal warning.

## Explicit Request Without Urgency

Input:

```json
{
  "messageId": "msg-2005",
  "subject": "Follow up on action items",
  "body": "Please follow up on the action items from our meeting. Keep me posted on progress.",
  "senderAddress": "eve@team.example",
  "receivedAt": "2026-07-16T11:00:00.000Z"
}
```

Expected:

- Confidence: `medium`, Urgency: `normal`.
- 3 steps with normal intervals.
- No warnings.

## Critical With Deadline

Input:

```json
{
  "messageId": "msg-2006",
  "subject": "Payment deadline 2026-07-25",
  "body": "Urgent: payment is due before 2026-07-25. Please follow up immediately.",
  "senderName": "Frank Finance",
  "senderAddress": "frank@billing.example",
  "receivedAt": "2026-07-15T16:00:00.000Z",
  "timeZone": "America/New_York"
}
```

Expected:

- Confidence: `high`, Urgency: `critical`.
- 3 steps: 1 day, 3 days, 7 days.

## Gentle Check-In (Low Urgency)

Input:

```json
{
  "messageId": "msg-2007",
  "subject": "Just checking in",
  "body": "Thought I would touch base and see how things are going. No hurry.",
  "senderName": "Grace Mentor",
  "senderAddress": "grace@mentor.example",
  "receivedAt": "2026-07-14T12:00:00.000Z"
}
```

Expected:

- Confidence: `medium`, Urgency: `normal`.
- Warning about no explicit follow-up request.

## Duplicate Sequence Detection

Input:

```json
{
  "messageId": "msg-2002",
  "existingSequences": [{ "sourceMessageId": "msg-2002", "title": "Existing" }]
}
```

Expected:

- Warning about existing sequence.

## Oversized Input (Guard Rejection)

Input: body > 50000 characters.

Expected:

- Guard returns `input-too-large` error.
- Engine never runs.

## Invalid Input (Guard Rejection)

Input: missing `messageId`.

Expected:

- Guard returns `invalid-input` error.
- Engine never runs.
