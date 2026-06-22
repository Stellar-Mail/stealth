# Team Calendar Extraction Setup Guide

## Prerequisites

| Requirement | Version | Notes |
| --- | --- | --- |
| Node.js | 20+ | Matches the main Stealth frontend baseline |
| npm | 10+ | Used from the repository root |

No live mailbox, calendar account, wallet, Stellar account, database, or third
party calendar API is required for this isolated testing and documentation pass.

## Folder boundary

All work for this tool stays inside:

```text
tools/v2/team/team-calendar-extraction/
```

Do not modify the main app shell, routing, inbox architecture, wallet core,
Stellar integration, database schema, authentication, or shared design system.

## Recommended local layout

```text
tools/v2/team/team-calendar-extraction/
  docs/
    SETUP.md
    REVIEW_NOTES.md
  tests/
    TEST_PLAN.md
  README.md
  specs.md
  vitest.config.ts
```

Future implementation work can add folder-local fixtures, services, hooks,
components, and `.test.ts` files.

## Validation commands

From the repository root:

```bash
# Confirm this contribution stays folder-local
git diff --name-only | grep -v "tools/v2/team/team-calendar-extraction/"

# Once executable tests are added
npx vitest run --config tools/v2/team/team-calendar-extraction/vitest.config.ts

# Optional project-level checks
npx tsc --noEmit
npm run lint
```

The folder-local scope command should return no output for this issue.

## Fixture guidance

Use synthetic messages and calendar event payloads only:

| Fixture | Purpose |
| --- | --- |
| `explicit-date-email` | Direct date/time extraction |
| `relative-date-email` | Phrases like tomorrow, next Friday, EOD |
| `timezone-email` | Sender and recipient in different zones |
| `multi-event-email` | Multiple events in one message |
| `low-confidence-email` | Ambiguous text requiring manual review |
| `duplicate-event-email` | Same event mentioned twice |

Fixtures must not include real customer messages, production calendar ids,
private mailbox identifiers, wallet secrets, or live meeting links.
