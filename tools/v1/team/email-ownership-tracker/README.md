# Email Ownership Tracker

A self-contained V1 team tool for tracking who currently owns an email thread
and preserving a bounded ownership history for review.

**Release tier:** V1
**Audience:** Team
**Isolation boundary:** `tools/v1/team/email-ownership-tracker/`

## Purpose

Team inboxes need a clear handoff trail. This tool provides folder-local
business logic for:

- validating ownership events before they are stored
- normalizing owner, thread, and actor identifiers
- sanitizing notes and reasons used in history rows
- appending events without mutating existing histories
- reading current ownership and compact thread histories
- bounding large histories so the future UI does not process unlimited input

## Folder Structure

```text
email-ownership-tracker/
├── docs/
│   ├── REVIEW_NOTES.md
│   └── SETUP.md
├── fixtures/
│   └── ownership.fixture.ts
├── services/
│   └── ownership.service.ts
├── tests/
│   ├── TEST_PLAN.md
│   └── ownership.service.test.ts
├── README.md
├── specs.md
└── vitest.config.ts
```

## Running Tests

From the repository root:

```bash
npx vitest run --config tools/v1/team/email-ownership-tracker/vitest.config.ts
```

## Boundary

This contribution is intentionally isolated. It does not import from the main
app, mutate shared app state, add routes, touch auth, change the inbox
architecture, or connect to external services.
