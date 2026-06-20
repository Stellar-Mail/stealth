# Team Calendar Extraction

Extract structured calendar events from team email threads — isolated V2 tool.

## Ownership Boundary

All work for this tool must stay inside:

```text
tools/v2/team/team-calendar-extraction/
```

Do not wire this tool into the main app, routing, inbox architecture, wallet core, Stellar core,
database schema, or existing design system unless a future integration issue explicitly allows it.

---

## Tool Workflow

1. Feed raw email messages (subject, body, to/cc headers, ICS attachment flag) into the
   extraction pipeline.
2. The service assesses extraction confidence (`high` / `medium` / `low`) based on keyword
   signals and ICS attachment presence.
3. Each message is assigned an event status: `confirmed`, `tentative`, or `cancelled`.
4. Attendees are resolved from `to` and `cc` headers; the sender is marked as the organiser.
5. Extracted events can be filtered by date range, grouped by status, or summarised.

---

## States

| State | Description |
|---|---|
| `confirmed` | Clear invitation language or ICS attachment present |
| `tentative` | Contains "tentative", "proposed", "pending", or "maybe" signals |
| `cancelled` | Contains "cancelled" or "cancellation" signals |

---

## Confidence Levels

| Level | Criteria |
|---|---|
| `high` | ICS attachment present **or** two or more strong event keywords in subject/body |
| `medium` | Exactly one strong event keyword (e.g., "meeting", "interview", "demo") |
| `low` | No identifiable event keywords |

---

## Folder Structure

```text
team-calendar-extraction/
├── types.ts                                   # TypeScript type definitions
├── services/
│   └── calendar-extraction.service.mjs        # Pure-function service layer
├── fixtures/
│   └── sample-calendar-emails.json            # Synthetic test fixture
├── tests/
│   └── calendar-extraction-fixtures.test.mjs  # Node built-in test runner
├── docs/
│   ├── test-plan.md                           # Manual + automated review steps
│   └── review-notes.md                        # Validation log and isolation guarantee
└── README.md                                  # This file
```

---

## Running the Tests

No build step or environment variable is required.  Run from the repository root:

```bash
node --test tools/v2/team/team-calendar-extraction/tests/calendar-extraction-fixtures.test.mjs
```

Expected result: all tests pass, zero failures.

---

## Fixtures

`fixtures/sample-calendar-emails.json` contains 6 synthetic source messages and 6 expected
events.  The dataset is intentionally small so contributors can reason about expected behaviour
without running the main application.

| Message ID | Scenario | Expected status | Confidence |
|---|---|---|---|
| `msg-cal-001` | Q3 planning meeting with ICS | `confirmed` | `high` |
| `msg-cal-002` | Interview confirmation, no ICS | `confirmed` | `medium` |
| `msg-cal-003` | Cancelled standup | `cancelled` | `medium` |
| `msg-cal-004` | Proposed/tentative product demo | `tentative` | `medium` |
| `msg-cal-005` | Mandatory workshop with ICS | `confirmed` | `high` |
| `msg-cal-006` | Informal sync call | `confirmed` | `medium` |

All addresses use the `example.test` domain.  No real personal data is included.

---

## Documentation Map

| File | Purpose |
|---|---|
| `specs.md` | Product contract, contributor scope, and required issue categories |
| `types.ts` | TypeScript interfaces for CalendarEvent, SourceMessage, and related types |
| `docs/test-plan.md` | Step-by-step manual and automated review checklist |
| `docs/review-notes.md` | What was validated and what remains out of scope |

---

## Known Limitations

- This contribution does not wire the tool into the main application shell or routing.
- Data comes from folder-local fixtures; a future issue should connect to live inbox data.
- iCalendar (RFC 5545) `.ics` parsing is not yet implemented — `hasIcsAttachment` is a boolean flag only.
- Timezone-aware normalisation, recurring events, and calendar API export are out of scope for this issue.
- Authorization, database writes, and notification side effects are not included.
