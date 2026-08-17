# Customer Support Macro Tool — OSS Review Notes

This document is written for OSS contributors and maintainers who are
reviewing this contribution. It explains exactly what was built, how to
verify it, and what intentionally does not exist yet.

---

## What this PR adds

| Deliverable                   | Location                              |
| ----------------------------- | ------------------------------------- |
| Core service (pure functions) | `services/macro.service.ts`           |
| Storage service + adapter     | `services/storage.service.ts`         |
| React hook                    | `hooks/useMacros.ts`                  |
| Test fixtures                 | `fixtures/macros.fixture.ts`          |
| Unit tests — service layer    | `tests/macro.service.test.ts`         |
| Unit tests — storage layer    | `tests/storage.service.test.ts`       |
| Test plan document            | `tests/TEST_PLAN.md`                  |
| Setup guide                   | `docs/SETUP.md`                       |
| OSS review notes              | `docs/REVIEW_NOTES.md` ← you are here |
| Updated README                | `README.md`                           |

**No file outside `tools/v1/team/customer-support-macro-tool/` is modified.**

---

## Quick review checklist

```bash
# 1. Verify isolation — should return ZERO results
grep -r "from.*\.\.\/\.\.\/\.\.\/src" tools/v1/team/customer-support-macro-tool/

# 2. Run the tests
npx vitest run tools/v1/team/customer-support-macro-tool/tests

# 3. Check TypeScript
npx tsc --noEmit

# 4. Verify no files changed outside the tool folder
git diff --name-only | grep -v "tools/v1/team/customer-support-macro-tool"
# → should be EMPTY (no output)
```

---

## Architecture decisions

### Why pure functions in the service layer?

Pure functions are the easiest code to test, review, and reason about.
`macro.service.ts` has zero side effects — every function takes inputs and
returns outputs. This also means the service can be used outside React
(Node.js scripts, server-side rendering) without modification.

### Why a pluggable storage adapter?

`StorageAdapter` is an interface with `getItem`, `setItem`, and `removeItem`.
Tests use `createInMemoryAdapter()` instead of `localStorage`, which means:

- No DOM globals needed in tests.
- No mocking of `window.localStorage`.
- The real browser persistence path is also covered by the same code paths.

### Why is the React hook not unit-tested?

The hook (`useMacros.ts`) is a thin wrapper around the fully-tested service
layer. Hook-level tests require `@testing-library/react`, which is not in
`devDependencies` yet. Adding it is tracked as a follow-up issue to keep
this PR small and reviewable. The service tests give us high confidence in
the logic.

### Why are there no UI components?

The issue category for this PR is **Testing and documentation**. Building
the UI is a separate issue. Keeping the boundary sharp makes each PR
independently reviewable.

---

## Test quality notes

- Every `describe` block maps to a single exported function.
- Tests follow the **Arrange → Act → Assert** pattern.
- Edge cases are explicit: empty strings, whitespace-only input, exact
  boundary values (title = 120 chars, body = 4000 chars), and malformed JSON.
- Immutability is verified by asserting the original fixture is not mutated.

---

## What a follow-up issue should do

A follow-up integration issue should:

1. Wire `useMacros` into a compose-window panel.
2. Call `useMacro(id, variables)` when an agent clicks "Apply macro".
3. Add `@testing-library/react` and write hook-level tests.
4. Add an E2E test that selects a macro and verifies the compose body is filled.

None of that work should happen in this PR.

---

## Labels this contribution satisfies

- **GrantFox OSS** — open-source contributor workflow
- **Maybe Rewarded** — eligible for OSS reward
- **Official Campaign** — part of V1 launch campaign
- **Tooling Ecosystem** — adds a tool to the ecosystem
- **V1 Launch Tool** — targeted for V1 release
- **Team Tool** — built for team audience

---

## Maintainer sign-off checklist

- [ ] Tests pass locally (`npx vitest run tools/v1/team/customer-support-macro-tool/tests`)
- [ ] TypeScript compiles (`npx tsc --noEmit`)
- [ ] No files changed outside the tool boundary
- [ ] `README.md` explains the tool clearly
- [ ] `TEST_PLAN.md` lists all test cases
- [ ] `docs/SETUP.md` allows a new contributor to get started in < 5 minutes
