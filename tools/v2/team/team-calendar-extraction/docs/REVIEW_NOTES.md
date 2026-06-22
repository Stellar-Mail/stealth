# Team Calendar Extraction OSS Review Notes

This document gives maintainers and contributors a fast review path for the
folder-local testing and documentation pass.

## What this PR adds

| Deliverable | Location |
| --- | --- |
| Setup guide | `docs/SETUP.md` |
| Test plan | `tests/TEST_PLAN.md` |
| Review notes | `docs/REVIEW_NOTES.md` |
| README links | `README.md` |

No file outside `tools/v2/team/team-calendar-extraction/` is part of this
change.

## Review checklist

```bash
git diff --name-only | grep -v "tools/v2/team/team-calendar-extraction/"
```

- [ ] Documentation explains independent review without calendar or app integration.
- [ ] Test plan covers date parsing, time zones, recurrence, duplicates, and confidence thresholds.
- [ ] No live mailbox, calendar API, wallet, or database configuration is introduced.
- [ ] No app shell, routing, inbox, authentication, or design-system code is touched.

## Future behavior to validate

The extractor should return structured candidate events from local email input:

- title or inferred subject
- start/end datetime with source timezone
- attendees and organizer candidates
- confidence score and evidence snippets
- duplicate or merge hints

Low-confidence extraction should never silently create a calendar event; it
should be marked for teammate review.
