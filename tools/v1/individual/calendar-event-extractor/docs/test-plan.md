# Calendar Event Extractor Test Plan

## Goals

- Verify extracted event drafts are explainable, editable, and deterministic.
- Guard against automatic mailbox, RSVP, invite, or calendar side effects.
- Confirm ambiguous dates and duplicate events are handled predictably.
- Keep all work inside the V1 individual tool folder.

## Automated Cases

1. Absolute date and time
   - Given an email with a meeting date, time, and title.
   - Expect `draft` or `ready` with title, `startAt`, confidence, and signals.

2. Relative date with timezone
   - Given received time, timezone, and "tomorrow at 10".
   - Expect deterministic `startAt` resolution.

3. Missing end time
   - Given a start time but no end time.
   - Expect draft with `endAt` omitted and a duration warning.

4. Location extraction
   - Given room or venue text.
   - Expect the location field populated without altering the message.

5. Duplicate event prevention
   - Given an existing draft for the same message and start time.
   - Expect no duplicate draft.

6. Conflicting date signals
   - Given subject and body with different dates.
   - Expect `ambiguous` with a conflict warning.

7. FYI false positive
   - Given a newsletter advertising an event without a personal action.
   - Expect no ready event or a low-confidence draft.

8. Empty content
   - Given missing subject and body.
   - Expect no draft or warning-only result without errors.

## Manual Review Checklist

- Confirm title, time, timezone, and state are text-visible.
- Confirm edit, confirm, and dismiss controls have accessible names.
- Confirm no external calendar entry, invite, RSVP, or email mutation occurs.
- Confirm ambiguity warnings are visible before confirmation.
- Confirm fixtures do not include real attendees, senders, locations, or dates.

## Regression Expectations

- Adding a new date rule requires a positive and ambiguous fixture.
- Adding location parsing requires long-location and missing-location fixtures.
- Any future calendar integration must preserve explicit user action before
  external side effects.
