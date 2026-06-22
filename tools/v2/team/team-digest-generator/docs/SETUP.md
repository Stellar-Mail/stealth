# Team Digest Generator Setup Guide

## Prerequisites

| Requirement | Version | Notes |
| --- | --- | --- |
| Node.js | 20+ | Required for the folder-local Node test |
| npm | 10+ | Optional for project-level checks |

No live mailbox, wallet, Stellar account, database, or mail relay is required to
review this isolated V2 tool.

## Folder boundary

All work for this tool stays inside:

```text
tools/v2/team/team-digest-generator/
```

Do not modify the main application shell, dashboard layout, routing, inbox
architecture, wallet core, Stellar integration, database schema, authentication,
or shared design system for this issue.

## Run the executable fixture test

From the repository root:

```bash
node --test tools/v2/team/team-digest-generator/tests/digest-fixtures.test.mjs
```

The test validates that the sample team activity fixture maps to the expected
digest contract and that the local service output stays deterministic.

## Review the fixtures

Start with:

```text
tools/v2/team/team-digest-generator/tests/fixtures.ts
```

Fixtures should remain synthetic and safe to commit. Do not add production
mailbox exports, real customer messages, private meeting links, wallet secrets,
or live team identifiers.

## Validate isolation

Before opening or merging a PR:

```bash
git diff --name-only | grep -v "tools/v2/team/team-digest-generator/"
```

The command should return no output for this issue.

## Optional project checks

```bash
npx tsc --noEmit
npm run lint
```

These checks are useful for maintainers, but this V2 tool remains isolated and
is not wired into the main app.

## Known limitations

- The digest tool uses local fixtures and deterministic service logic only.
- Main app integration, routing, shared mailbox permissions, and persistence are
  out of scope.
- UI-level accessibility tests should be expanded when a future issue adds the
  rendered digest surface.
