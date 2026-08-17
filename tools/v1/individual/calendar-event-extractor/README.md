# Calendar Event Extractor

V1 individual tool workspace for extracting reviewable calendar event drafts
from email content.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v1/individual/calendar-event-extractor/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core, database schema, or existing design system unless a future integration issue explicitly allows it.

## Intended Use

- Inspect normalized subject, body, sender, received time, and optional timezone.
- Extract candidate event title, start/end time, location, attendees, and notes.
- Return an editable event draft that the user can confirm or dismiss.
- Keep the extractor advisory; it must not create external calendar events,
  send invites, RSVP, or mutate email automatically.

## Event Draft States

- `draft`: extracted event candidate waiting for user review.
- `ready`: sufficient details exist and the user can confirm creation.
- `ambiguous`: missing or conflicting time/location details need review.
- `dismissed`: user rejected the event candidate.

## Testing Focus

Use `docs/test-plan.md` and `docs/fixtures.md` to cover absolute dates,
relative dates, timezones, missing end times, location extraction, duplicate
event prevention, FYI false positives, empty content, accessibility, and
non-mutating behavior.
