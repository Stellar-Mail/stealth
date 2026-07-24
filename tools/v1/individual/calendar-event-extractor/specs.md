# Calendar Event Extractor

Extract reviewable calendar event drafts in a V1 individual workspace.

## Scope

- Release tier: V1
- Audience: individual
- Folder ownership: `tools/v1/individual/calendar-event-extractor/`

This is a self-contained tooling workspace. Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, or design system unless a future integration issue explicitly allows it.

## Purpose

Help an individual user turn event-like email content into editable calendar
drafts without creating external calendar entries automatically.

## Functional Contract

- Input: normalized email subject, body, sender display/address, received time,
  optional timezone, and optional existing event draft records.
- Output: one event extraction review model.
- The review model should include:
  - `state`
  - `confidence`
  - `title`
  - `startAt`
  - optional `endAt`
  - optional `location`
  - optional `attendees`
  - `signals`
  - `warnings`
- Extracted events start as drafts until the user confirms creation.
- If date or time signals conflict, return `ambiguous` with warnings.
- Duplicate event drafts for the same message and start time must be avoided.
- The tool must not create external calendar events, send invites, RSVP, mark
  messages read, archive, delete, label, reply, or forward email.

## Signal Categories

- Event terms such as meeting, appointment, call, demo, interview, webinar,
  deadline, or schedule.
- Absolute dates and times.
- Relative dates resolved with the caller-provided timezone.
- Location hints such as address, room, video link label, or venue name.
- Attendee hints from sender and body context.
- False-positive contexts such as newsletters, receipts, historical summaries,
  or event advertisements without a personal action.

## Required Issue Categories

- Architecture
- Feature
- UI and accessibility
- Security and performance
- Testing and documentation

## UI And Accessibility Expectations

- Draft title, time, timezone, and state must be visible as text.
- Edit, confirm, and dismiss controls must be keyboard reachable.
- Ambiguity warnings must be screen-reader reachable.
- Long locations or attendee lists must not break layout.

## Security And Performance Expectations

- Do not mutate the mailbox in baseline tests.
- Do not create external calendar events or send invites in baseline tests.
- Do not transmit event details to external services in baseline tests.
- Date parsing must be bounded for long messages.
- Fixtures must use synthetic senders, attendees, locations, and dates only.

## Testing Expectations

See:

- `docs/test-plan.md`
- `docs/fixtures.md`
