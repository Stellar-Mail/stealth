# Review Notes – Team Calendar Extraction

## What This Contribution Adds

- **`types.ts`** – TypeScript type definitions for `CalendarEvent`, `SourceMessage`,
  `EventAttendee`, `CalendarExtractionFixture`, `ExtractionConfidence`, and `EventStatus`.
- **`services/calendar-extraction.service.mjs`** – Pure-function service layer with no external
  dependencies: confidence assessment, status derivation, attendee extraction, date filtering,
  status grouping, and summary statistics.
- **`fixtures/sample-calendar-emails.json`** – Synthetic fixture with 6 source messages and 6
  expected events covering confirmed, tentative, and cancelled states; ICS-backed and plain-text
  email paths.
- **`tests/calendar-extraction-fixtures.test.mjs`** – Zero-dependency test suite using Node's
  built-in `node:test` runner. Validates the fixture contract and all exported service functions.
- **`docs/test-plan.md`** – Manual and automated review steps, edge case inventory, and future
  integration test guidance.
- **`README.md`** – Full contributor-friendly documentation: workflow, states, fixture map,
  run instructions, known limitations.

---

## Validation Performed

```bash
node --test tools/v2/team/team-calendar-extraction/tests/calendar-extraction-fixtures.test.mjs
```

All tests pass. No files outside `tools/v2/team/team-calendar-extraction/` were modified.

---

## Reviewer Focus

- This contribution is **scoped to testing and documentation** only.
- The service module contains pure functions with no side effects and no dependency on the
  main app or any external package.
- The fixture uses only `example.test` addresses; no real personal data is present.
- No authentication, routing, database schema, or design system changes are included.

---

## Isolation Guarantee

| What changed                              | Status                     |
| ----------------------------------------- | -------------------------- |
| `tools/v2/team/team-calendar-extraction/` | ✅ All new files, isolated |
| Main app shell / routing                  | ❌ Not touched             |
| Inbox architecture                        | ❌ Not touched             |
| Wallet / Stellar core                     | ❌ Not touched             |
| Database schema                           | ❌ Not touched             |
| Existing design system                    | ❌ Not touched             |
| CI unit test suite (`tests/unit/`)        | ❌ Not touched             |

---

## Follow-Up Work

- Implement an iCalendar (RFC 5545) parser to extract structured event data from `.ics` files.
- Add UI components (list view, event detail panel, status badge) once a UI issue is opened.
- Add accessibility review once UI components exist.
- Add security review for untrusted email body parsing before any live mailbox integration.
- Connect to live inbox data only after a future integration issue explicitly permits it.
