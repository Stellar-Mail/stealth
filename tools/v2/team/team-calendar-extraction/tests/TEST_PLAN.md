# Team Calendar Extraction Test Plan

## Summary

This plan defines folder-local coverage for extracting shared calendar event
candidates from team email content.

## Goals

- Extract explicit dates, relative dates, times, attendees, and event titles.
- Preserve evidence snippets so teammates can review each candidate.
- Avoid duplicate event creation from repeated mentions.
- Flag ambiguous extraction for manual review.
- Keep all fixtures local and synthetic.

## Proposed test topology

```text
tools/v2/team/team-calendar-extraction/
  fixtures/
    calendar-emails.fixture.ts
  services/
    calendarExtraction.service.ts
  tests/
    calendarExtraction.service.test.ts
    TEST_PLAN.md
```

## Unit scenarios

| Area | Scenario | Expected result |
| --- | --- | --- |
| Explicit date | "June 24 at 10:00" | One event candidate with exact start |
| Relative date | "next Friday morning" | Candidate resolved from fixture clock |
| Time zone | "3pm London time" | Candidate stores timezone evidence |
| Duration | "30 min sync" | End time inferred from duration |
| Attendees | Named teammates in message | Attendees extracted as candidates |
| Multiple events | Two separate dates in one email | Two candidates returned |
| Duplicate mention | Same event repeated in thread | One candidate with duplicate evidence |
| Low confidence | "sometime next week" | Manual-review candidate, no auto-create |
| No event | Status email with no schedule language | Empty result |
| Invalid input | Empty body | Validation error |

## Integration scenarios

### Explicit meeting email

1. Fixture email contains title, date, time, and attendees.
2. Extraction service runs against the body.
3. Verify one event candidate is returned.
4. Verify evidence points to the source phrase.

### Ambiguous scheduling thread

1. Fixture thread contains "maybe next week".
2. Service attempts extraction.
3. Verify candidate is marked low confidence.
4. Verify no auto-create flag is set.

### Duplicate event guard

1. Fixture thread mentions the same customer kickoff twice.
2. Service extracts candidates.
3. Verify only one normalized candidate remains.
4. Verify duplicate evidence is preserved for review.

## Manual review checklist

- [ ] Candidate event title is understandable without opening the whole email.
- [ ] Time zone evidence is visible.
- [ ] Low-confidence candidates require teammate confirmation.
- [ ] Duplicate candidates can be reviewed before acceptance.
- [ ] Keyboard users can inspect extraction evidence.
- [ ] Fixtures use synthetic senders, attendees, and meeting links only.

## Known limitations

- Natural language parsing policy is not implemented in this documentation pass.
- Real calendar provider writes are out of scope for the isolated V2 tool.
- App integration should be handled by a future explicit integration issue.
