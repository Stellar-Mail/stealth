# Shared Contact Notes Setup Guide

## Prerequisites

| Requirement | Version | Notes |
| --- | --- | --- |
| Node.js | 20+ | Matches the main Stealth frontend baseline |
| npm | 10+ | Used from the repository root |

No wallet, Stellar account, database, relay server, or production contact data
is required to review this isolated tool.

## Folder boundary

All work for this tool stays inside:

```text
tools/v2/team/shared-contact-notes/
```

Do not wire this tool into the app shell, routing, dashboard layout, inbox
architecture, wallet core, Stellar integration, database schema, or shared
design system from this issue.

## Install dependencies

From the repository root:

```bash
npm install
```

This tool uses the project-level Vitest, TypeScript, React, and testing-library
dependencies already declared in `package.json`.

## Run the folder-local tests

```bash
npx vitest run tools/v2/team/shared-contact-notes/tests
```

To focus on one layer:

```bash
npx vitest run tools/v2/team/shared-contact-notes/tests/service.test.ts
npx vitest run tools/v2/team/shared-contact-notes/tests/components.test.tsx
```

## Review the fixtures

The deterministic seed data lives in:

```text
tools/v2/team/shared-contact-notes/fixtures/notes.ts
```

Fixtures use synthetic contact ids, user ids, content, and timestamps. Do not
replace them with production contact records or real customer data.

## Validate isolation

Before opening or merging a PR:

```bash
git diff --name-only | grep -v "tools/v2/team/shared-contact-notes/"
```

The command should return no output for this issue.

## Optional project checks

```bash
npx tsc --noEmit
npm run lint
```

These commands are helpful for maintainers, but this V2 tool is intentionally
not wired into the main app yet.

## Known limitations

- Notes are stored in memory only.
- There is no authentication or authorization layer yet.
- The UI is self-contained and not connected to the main contact model.
- Realtime collaboration and persistence should be handled by future
  integration issues.
