# Suspicious Sender Watchlist Setup Guide

## Prerequisites

| Requirement | Version | Notes |
| --- | --- | --- |
| Node.js | 20+ | Matches the main Stealth frontend baseline |
| npm | 10+ | Used from the repository root |

No live mailbox, wallet, Stellar account, database, or threat-intelligence API is
required for this isolated testing and documentation pass.

## Folder boundary

All work for this tool stays inside:

```text
tools/v2/team/suspicious-sender-watchlist/
```

Do not modify the main application shell, dashboard layout, routing, inbox
architecture, wallet core, Stellar integration, database schema, authentication,
or shared design system for this issue.

## Recommended local layout

```text
tools/v2/team/suspicious-sender-watchlist/
  docs/
    SETUP.md
    REVIEW_NOTES.md
  tests/
    TEST_PLAN.md
  README.md
  specs.md
```

Future implementation work can add folder-local `fixtures/`, `services/`,
`hooks/`, `components/`, and `.test.ts` files.

## Validation commands

From the repository root:

```bash
# Confirm this contribution stays folder-local
git diff --name-only | grep -v "tools/v2/team/suspicious-sender-watchlist/"

# Once executable tests are added
npx vitest run tools/v2/team/suspicious-sender-watchlist/tests

# Optional project-level checks
npx tsc --noEmit
npm run lint
```

The folder-local scope command should return no output for this issue.

## Fixture guidance

Use synthetic, deterministic fixtures only:

| Fixture | Purpose |
| --- | --- |
| `known-bad-sender` | Sender that should always match the watchlist |
| `domain-level-hit` | Domain match that should warn on any mailbox from that domain |
| `false-positive-sender` | Similar address that must not match |
| `expired-entry` | Watchlist entry past its review window |
| `suppressed-entry` | Entry paused by a teammate with audit reason |

Do not include production sender addresses, private mailbox identifiers, wallet
secrets, API tokens, or real threat-intelligence exports.
