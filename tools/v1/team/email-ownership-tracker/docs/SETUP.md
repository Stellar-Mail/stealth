# Email Ownership Tracker Setup Guide

## Prerequisites

| Requirement | Version | Notes |
| --- | --- | --- |
| Node.js | 20+ | Matches the main Stealth frontend baseline |
| npm | 10+ | Used from the repository root |

No live mailbox, wallet, Stellar account, database, or relay server is required
for this isolated documentation and test-plan pass.

## Folder boundary

All work for this tool must stay inside:

```text
tools/v1/team/email-ownership-tracker/
```

Do not modify app routing, dashboard layout, authentication, wallet core,
Stellar integration, database schema, shared inbox architecture, or the design
system for this issue.

## Recommended local layout

```text
tools/v1/team/email-ownership-tracker/
  docs/
    SETUP.md
    REVIEW_NOTES.md
  tests/
    TEST_PLAN.md
  README.md
  specs.md
```

Future implementation work can add folder-local `fixtures/`, `services/`,
`hooks/`, and `.test.ts` files.

## Validation commands

From the repository root:

```bash
# Confirm the contribution stays folder-local
git diff --name-only | grep -v "tools/v1/team/email-ownership-tracker/"

# Once service tests exist
npx vitest run tools/v1/team/email-ownership-tracker/tests

# Optional project-level checks
npx tsc --noEmit
npm run lint
```

The folder-local check should return no output for this issue.

## Fixture guidance

Fixtures should be deterministic and safe to commit:

| Fixture | Purpose |
| --- | --- |
| `unassigned-thread` | Message or thread with no current owner |
| `assigned-thread` | Active owner with assigned timestamp |
| `handoff-history` | Ownership transferred between teammates |
| `released-thread` | Owner explicitly releases the item |
| `stale-owner` | Owner has not acted before a configured timeout |
| `audit-export-safe` | History view with redacted external payloads |

Use fake Stealth addresses and synthetic message ids only. Do not include
production sender data, wallet secrets, private keys, or mailbox identifiers.

## Known limitations

- This issue documents setup, review notes, and a test plan; it does not add the
  ownership service implementation.
- Persistence adapter choice is deferred until the core feature issue lands.
- App shell and shared inbox integration remain out of scope.
