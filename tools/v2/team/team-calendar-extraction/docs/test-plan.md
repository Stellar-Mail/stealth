# Test Plan – Team Calendar Extraction

## Automated Tests

Run from the repository root:

```bash
node --test tools/v2/team/team-calendar-extraction/tests/calendar-extraction-fixtures.test.mjs
```

No additional setup, build step, or environment variable is required.

### What the test covers

| Area | Description |
|---|---|
| Fixture contract | Tool identifier, version field, array presence, 1:1 source-to-event mapping, unique IDs |
| Source message fields | Required strings, valid ISO receivedAt, to/cc arrays, boolean hasIcsAttachment |
| Expected event fields | Required strings, valid ISO startAt/endAt, endAt ≥ startAt, allowed status values, allowed confidence values, attendee list shape |
| Fixture coverage | All three status values represented; ICS-backed and non-ICS events both present |
| `assessConfidence` | ICS attachment → high; two keywords → high; one keyword → medium; no keywords → low |
| `deriveStatus` | Cancellation keywords → cancelled; tentative/proposed keywords → tentative; plain invite → confirmed |
| `extractAttendees` | All to/cc addresses included; sender marked organiser; exactly one organiser; deduplication |
| `isValidIsoDate` | Valid ISO date-times accepted; date-only strings rejected; non-strings rejected |
| `filterEventsByDateRange` | Events within range returned; empty for out-of-range; exact boundary date inclusive |
| `groupEventsByStatus` | Each group contains only events with its status; totals sum correctly |
| `summariseEvents` | Counts match manual counts; high-confidence count correct; all-zero for empty input |

### Expected output

All test suites pass with zero failures.  Example output:

```
▶ sample-calendar-emails.json — fixture contract
  ✔ has the correct tool identifier
  ✔ has a version field
  ...
▶ assessConfidence
  ✔ returns high for messages with an ICS attachment
  ...
ℹ tests 60+
ℹ pass  60+
ℹ fail  0
```

---

## Manual Review Checklist

1. Open `fixtures/sample-calendar-emails.json`.
   - Confirm all addresses use `example.test` domain only.
   - Confirm no real personal data, credentials, or calendar content is present.
   - Confirm every `expectedEvent` has a `sourceMessageId` that matches a `sourceMessages` entry.

2. Open `services/calendar-extraction.service.mjs`.
   - Confirm there are no `import` statements referencing the main app.
   - Confirm no environment variables are read.

3. Open `tests/calendar-extraction-fixtures.test.mjs`.
   - Confirm only `node:test`, `node:assert`, `node:fs/promises`, and the local service module are imported.
   - Confirm no network calls are made.

4. Check that no files outside `tools/v2/team/team-calendar-extraction/` were modified.

---

## Edge Cases Covered

- **ICS-backed confirmation** – `msg-cal-001` and `msg-cal-005` have `hasIcsAttachment: true` and are expected to yield `"high"` confidence.
- **Cancellation detection** – `msg-cal-003` contains "Cancelled" in the subject and maps to a `"cancelled"` event.
- **Tentative / proposed detection** – `msg-cal-004` contains "Tentative" and "proposed" and maps to a `"tentative"` event.
- **Duplicate attendee deduplication** – `extractAttendees` strips addresses that appear in both `to` and `cc`.
- **Empty input guards** – `filterEventsByDateRange`, `groupEventsByStatus`, and `summariseEvents` all handle empty arrays correctly.

---

## Future Integration Tests

When implementation code is added, extend tests to cover:

- Parsing real iCalendar (RFC 5545) `.ics` attachments.
- Handling multi-occurrence / recurring events.
- Timezone-aware event time normalisation.
- Duplicate event detection across multiple source messages.
- Owner assignment and reassignment workflows.
- Calendar API export (Google Calendar, Outlook) integration points.
