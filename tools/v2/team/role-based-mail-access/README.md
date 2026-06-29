# Role-Based Mail Access

Release tier: V2
Audience: team

Role-Based Mail Access is an isolated tool for checking whether a team member can read, write, assign, delete, or manage mail threads based on a declared role policy.

## Isolation Boundary

All work for this issue stays inside `tools/v2/team/role-based-mail-access/`.

Do not connect this tool to the main application shell, dashboard layout, navigation, authentication, wallet core, mail rendering engine, inbox architecture, routing, Stellar integration, database schema, or design system.

## What Lives Here

- [types/index.ts](types/index.ts): shared request, policy, and log types.
- [fixtures/sample-access-requests.json](fixtures/sample-access-requests.json): local fixture data with valid requests and hostile inputs.
- [guards/access-guards.mjs](guards/access-guards.mjs): validation, sanitization, and size guards.
- [services/access.service.ts](services/access.service.ts): in-memory policy and audit-log service.
- [hooks/use-role-based-access.ts](hooks/use-role-based-access.ts): React wrapper around the service.
- [components/](components): presentational matrix, verifier, and console UI.
- [demo.tsx](demo.tsx): isolated preview entry.
- [tests/](tests): folder-local guard and service coverage plus the test plan.
- [docs/](docs): contributor docs, architecture notes, accessibility guidance, and reviewer notes.

## Setup

1. Install the repo dependencies from the project root if they are not already present.
2. Keep changes inside this tool folder so the issue remains reviewable on its own.

## Usage

Run the local checks from the repository root:

```bash
node --test tools/v2/team/role-based-mail-access/tests/access-guards.test.mjs
npx vitest -c tools/v2/team/role-based-mail-access/vitest.config.ts run
```

For a quick contributor checklist, start with [tests/test-plan.md](tests/test-plan.md) and then read [docs/review-notes.md](docs/review-notes.md).

## Fixtures

The fixture set is intentionally small and reviewable:

- 5 valid requests that cover every role and a mix of allowed and denied actions
- 19 hostile inputs that exercise the guard layer
- boundary limits for team size, attachment count, role length, thread ID length, and email length

See [fixtures/sample-access-requests.json](fixtures/sample-access-requests.json) for the exact payloads.

## Known Limitations

- The tool is in-memory only; there is no persistence layer.
- The tool does not integrate with the main mail app yet.
- There is no mailbox routing, wallet, Stellar, or database work in this issue.
- Future app wiring should be handled in a separate follow-up issue.
