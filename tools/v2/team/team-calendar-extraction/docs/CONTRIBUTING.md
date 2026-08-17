# Contributing to Team Calendar Extraction

This folder is a **self-contained V2 team tool**. It is intentionally isolated from
the main application (shell, navigation, auth, wallet core, mail rendering engine,
routing, Stellar core, DB schema, and the shared design system). Treat it as a
mini-product: changes here should be reviewable on their own.

## Scope boundary

All work for this issue must stay inside:

```text
tools/v2/team/team-calendar-extraction/
```

Do **not** wire this tool into the main app, and do not modify app-wide code.
If a future integration is needed, write it as a separate follow-up issue.

## What the tool does

Extracts calendar events from team emails in two ways:

1. **ICS attachments** — parses `.ics` (text/calendar) attachments safely.
2. **Text scan** — scans the email subject/body for meeting indicators
   (`meeting`, `sync`, `call`, `review`, `standup`, `workshop`, `discussion`,
   `calendar`, `zoom`, `meet.google`) and derives a lightweight event.

Every extracted value is **sanitized** (HTML/script stripping, email normalization,
filename traversal protection) and **validated** (format, length, attendee caps)
before it becomes an event. See `docs/security-threat-model.md` and
`docs/performance-guidelines.md` for the safety design.

## Local setup

```bash
# from repo root
bun install
cd tools/v2/team/team-calendar-extraction
bunx vitest run        # run this tool's tests in isolation
```

The tool has its own `vitest.config.ts`, so you can run its suite without the
rest of the workspace. Prefer this during review.

## Layout

```text
team-calendar-extraction/
├── types/index.ts                 # CalendarEvent, EmailData, ValidationResult, ...
├── services/
│   ├── sanitization.ts            # HTML/text/filename sanitizers
│   ├── validation.ts              # email + event validators (length/attendee caps)
│   ├── ics-parser.ts              # line-length/event/size guarded ICS parser
│   └── extraction.service.ts      # orchestrator: processTeamEmails()
├── hooks/use-calendar-extraction.ts
├── components/                    # TeamCalendarExtraction, EventList, StatusIndicators
├── fixtures/calendar.fixtures.ts  # valid / malicious emails, ICS generators
├── tests/
│   ├── calendar-security.test.ts  # sanitization, validation, parser limits
│   └── extraction.test.ts         # core behavior: extraction, progress, batching
├── docs/
│   ├── security-threat-model.md
│   ├── performance-guidelines.md
│   └── CONTRIBUTING.md            # this file
└── demo.tsx
```

## Running the tests

```bash
bunx vitest run tests/calendar-security.test.ts
bunx vitest run tests/extraction.test.ts
```

Both files must stay green. `calendar-security.test.ts` covers adversarial input
and parser limits; `extraction.test.ts` covers the happy path, the progress
callback, batch truncation, and empty input.

## Fixtures

`fixtures/calendar.fixtures.ts` exports:

- `validEmails` — two benign emails (one text-scan, one with a valid `.ics`).
- `maliciousEmails` — XSS/phishing email + path-traversal `.ics` filename.
- `generateLargeIcsContent(n)` — produces `n` VEVENTs (use to test the 100-event cap).
- `generateOverlyLongLineIcs()` — a VEVENT with a >1000-char property line.

When adding behavior tests, reuse these fixtures before inventing new ones.

## Known limitations

- Text-scan extraction is heuristic: it only detects a meeting when a known
  indicator word is present, and it derives a date from the first `YYYY-MM-DD`
  (or `DD/MM/YYYY`) match in the sanitized body. It does **not** parse natural
  language like "next Tuesday".
- End time from text scan is always **start + 1 hour**.
- ICS parser supports a flat VEVENT structure (no nested/recurrence expansion
  beyond recording `RRULE` as text).
- Batch processing is capped at **50 emails per call** (`MAX_EMAILS_PER_BATCH`);
  larger inputs are truncated with a sanitization-log warning.
- File/line/event limits: 2 MB ICS, 1000-char lines, 100 events, 2000-char
  properties, 50 attendees.

## Review notes for OSS contributors

- Keep changes **inside this folder**. PRs that touch app-wide code will be
  rejected for this issue.
- Add or extend tests for any new behavior; this tool values small, reviewable,
  folder-local changes.
- Sanitization/validation are security-critical — if you change a limit or a
  sanitizer, add a test that proves the guard still holds.
- Run `bunx vitest run` from this folder before opening a PR.
- Document any new known limitation in the section above.
