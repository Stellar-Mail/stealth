# Role-Based Mail Access UI

This document is the contributor-facing guide for the isolated Role-Based Mail Access tool.

## Setup

1. Install the repo dependencies from the project root.
2. Work only inside `tools/v2/team/role-based-mail-access/`.
3. Keep review changes limited to the tool-local tests, docs, fixtures, and services.

## Usage

Run the local checks from the repository root:

```bash
node --test tools/v2/team/role-based-mail-access/tests/access-guards.test.mjs
npx vitest -c tools/v2/team/role-based-mail-access/vitest.config.ts run
```

If you only want the reviewer checklist, start with [../tests/test-plan.md](../tests/test-plan.md) and [review-notes.md](review-notes.md).

## Visual States

The UI uses a dark, high-contrast palette with four main states:

1. Empty state for a fresh console.
2. Loading state while a verification is simulated.
3. Granted and denied states for policy outcomes.
4. Error state for validation failures.

Those states are rendered by the local components in [../components](../components).

## Fixtures

The local fixture file [../fixtures/sample-access-requests.json](../fixtures/sample-access-requests.json) contains:

- valid requests that exercise all allowed roles
- hostile inputs for role, access level, email, and thread ID validation
- boundary values for team and attachment limits

The fixture is read by [../components/AccessConsole.tsx](../components/AccessConsole.tsx) and the folder-local tests.

## Known Limitations

- No main-app integration exists yet.
- No mail rendering engine, routing, database, wallet, or Stellar work lives here.
- All policies and logs are in-memory only.
- The review harness is intentionally isolated and should stay that way until a separate integration issue is approved.
