# Collision Detection Setup Guide

## Prerequisites

| Requirement | Version | Notes |
| --- | --- | --- |
| Node.js | 20+ | Matches the main Stealth frontend baseline |
| npm | 10+ | Used from the repository root |

No wallet, Stellar account, relay server, or production inbox data is required
for this isolated testing and documentation pass.

## Folder boundary

All review work for this issue stays inside:

```text
tools/v1/team/collision-detection/
```

Do not wire this tool into the app shell, routing, inbox architecture, wallet
core, Stellar core, database schema, or shared design system while reviewing
this issue.

## Recommended local layout

```text
tools/v1/team/collision-detection/
  docs/
    SETUP.md
    REVIEW_NOTES.md
  tests/
    TEST_PLAN.md
  README.md
  specs.md
```

Future implementation PRs can add `fixtures/`, `services/`, `hooks/`, and
`.test.ts` files inside this folder without changing the folder boundary.

## Validation commands

From the repository root:

```bash
# Confirm this contribution is folder-local
git diff --name-only | grep -v "tools/v1/team/collision-detection/"

# When implementation tests are added later
npx vitest run tools/v1/team/collision-detection/tests

# Optional full project checks
npx tsc --noEmit
npm run lint
```

The first command should produce no output for this issue.

## Fixture guidance

Use deterministic, local-only fixtures. A useful minimal fixture set is:

| Fixture | Purpose |
| --- | --- |
| `single-owner-thread` | Baseline thread with one active responder |
| `parallel-draft-thread` | Two teammates drafting against the same sender message |
| `resolved-thread` | Previously handled message that should not trigger a new collision |
| `same-sender-new-topic` | Same sender but unrelated subject/body |
| `handoff-thread` | Explicit ownership transfer between teammates |

Fixtures must not include live customer messages, private keys, wallet secrets,
production mailbox identifiers, or real sender data.

## Known limitations

- This issue documents the expected test plan; it does not implement collision
  detection services.
- App integration and UI behavior are intentionally out of scope.
- Realtime multi-tab conflict resolution should be tested in a future
  implementation issue once the data model is available.
